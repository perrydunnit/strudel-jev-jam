import { getAudioContext, getSuperdoughAudioController } from '@strudel/web'
import { findInstrument, type Instrument, type InstrumentId } from '../domain/samples'
import { loadBuffer, loadInstrument, pickSample, preloadRange, type SampleInstrument } from './sampler'
import { loadSoundfontNote, soundfontNote } from './soundfonts'

export type LiveVoice = {
  strike: (note: number, velocity: number) => void
  release: (note: number) => void
  allNotesOff: () => void
  setSolo: (id: InstrumentId) => void
  setEnabled: (enabled: boolean) => void
  /** Output level for the lead, as a multiplier over the per-voice level. */
  setLevel: (value: number) => void
  /**
   * The lead's output stage, so a visualiser can tap it. Built on first call, which is the
   * same stage the notes play through, so tapping it adds nothing to the signal path.
   */
  monitor: () => AudioNode | undefined
  /** Fetch and decode every sample covering a key range; resolves to the file count. */
  preload: (low: number, high: number) => Promise<number>
}

/**
 * The lead starts above the per-voice level it used to be pinned to, because being too
 * quiet is the complaint that produced this control. Above 1 the limiter starts working.
 */
export const DEFAULT_LEAD_LEVEL = 2
export const LEAD_LEVEL_RANGE = { min: 0, max: 3, step: 0.05 }

type Sounding = {
  started: number
  release: number
  amp: GainNode
  sources: AudioScheduledSourceNode[]
  /** Filter and effect sends, disconnected once the note has faded. */
  nodes: AudioNode[]
}

type VoiceParams = { attack: number; release: number; lpf: number; room: number; delay: number; gain: number }

type Space = { delay: AudioNode; reverb: AudioNode }

const MAX_VOICES = 16

/** Tone and envelope for the sampled solo instruments. Kept above the backing so
 * the solo line sits on top of the arrangement rather than inside it. */
const SAMPLE_VOICE: VoiceParams = { attack: 0.004, release: 0.35, lpf: 9000, room: 0.3, delay: 0.18, gain: 0.95 }
/** Fallback for the built-in synth option. */
const SYNTH_VOICE: VoiceParams = { attack: 0.006, release: 0.5, lpf: 2600, room: 0.4, delay: 0.2, gain: 0.3 }

const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12)

/**
 * A polyphonic keyboard voice that supports real note-off.
 *
 * Strudel's own trigger can start a note but never stop one: `superdough` returns
 * `undefined`, `getSuperdoughAudioController()` exposes no release method, and
 * `getTrigger()` hands back an object with no `stop`. A pattern note therefore
 * lasts exactly its `duration`.
 *
 * So this voice builds its own envelope on Strudel's AudioContext and connects
 * into Strudel's master output (`output.destinationGain`), which means it shares
 * the same context, master chain and effects space as the jam while gaining a
 * release stage that follows the key.
 */
export function createLiveVoice(initial: InstrumentId): LiveVoice {
  let solo: Instrument = findInstrument(initial)
  let enabled = true
  let instrument: SampleInstrument | undefined
  let loading: Promise<SampleInstrument> | undefined
  /** Keys currently down, so a sample that finishes loading late can be dropped. */
  const held = new Set<number>()
  const sounding = new Map<number, Sounding>()
  let master: AudioNode | undefined
  let space: Space | undefined
  /** The lead's own output stage, so a single control moves every note at once. */
  let voiceOut: GainNode | undefined
  let leadLevel = DEFAULT_LEAD_LEVEL

  const destination = (context: AudioContext): AudioNode => {
    if (master) return master
    try {
      const output = getSuperdoughAudioController().output
      master = output?.destinationGain ?? context.destination
    } catch {
      master = context.destination
    }
    return master
  }

  /**
   * Everything the lead plays is summed here before joining Strudel's master chain, dry
   * note, delay and reverb alike. Keeping it as one node is what makes the level control
   * affect notes that are already ringing, not just the next one.
   *
   */
  /**
   * A soft clipper that saturates to exactly 1. No Web Audio compressor has lookahead, so
   * the guard below still lets the first couple of milliseconds of a chord attack through,
   * and the master is a hard-clipped destination - which is why a chord at the top of the
   * range would crackle without this. Below 0.6 the curve is the identity, so the lead is
   * untouched at normal levels and the shaping only happens on the overshoot.
   */
  const softClip = (context: AudioContext): WaveShaperNode => {
    const shaper = context.createWaveShaper()
    const knee = 0.6
    const samples = 2048
    const curve = new Float32Array(samples)
    for (let i = 0; i < samples; i += 1) {
      const x = (i / (samples - 1)) * 2 - 1
      const magnitude = Math.abs(x)
      const shaped = magnitude <= knee
        ? magnitude
        : knee + (1 - knee) * Math.tanh((magnitude - knee) / (1 - knee))
      curve[i] = Math.sign(x) * shaped
    }
    shaper.curve = curve
    shaper.oversample = '2x'
    return shaper
  }

  /**
   * The stage the level control drives.
   *
   * The old fixed level was already within half a decibel of the ceiling a single note can
   * reach, so extra level on its own buys almost nothing - and that is the complaint this
   * answers. What makes a part louder past that point is density, so the knob drives the
   * input of a compressor: turning it up trades peaks for average level, which is what
   * gets heard as louder. The threshold sits below the lead's normal peak, so the trade
   * happens across the whole range instead of only at the top, and the makeup gain keeps a
   * low setting behaving like the plain fader it looks like.
   */
  const voiceOutput = (context: AudioContext): AudioNode => {
    if (voiceOut) return voiceOut
    voiceOut = context.createGain()
    voiceOut.gain.value = leadLevel
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 3
    limiter.attack.value = 0.005
    limiter.release.value = 0.15
    const makeup = context.createGain()
    makeup.gain.value = 1.4
    const clip = softClip(context)
    voiceOut.connect(limiter).connect(makeup).connect(clip).connect(destination(context))
    return voiceOut
  }

  const createSpace = (context: AudioContext, target: AudioNode): Space => {
    const delay = context.createDelay(1)
    delay.delayTime.value = 0.28
    const feedback = context.createGain()
    feedback.gain.value = 0.35
    const delayWet = context.createGain()
    delayWet.gain.value = 0.9
    delay.connect(feedback).connect(delay)
    delay.connect(delayWet).connect(target)

    // Cheap algorithmic reverb: decaying noise as the impulse response.
    const seconds = 2.6
    const length = Math.floor(context.sampleRate * seconds)
    const impulse = context.createBuffer(2, length, context.sampleRate)
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel)
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2.6
      }
    }
    const reverb = context.createConvolver()
    reverb.buffer = impulse
    const reverbWet = context.createGain()
    reverbWet.gain.value = 0.55
    reverb.connect(reverbWet).connect(target)

    return { delay, reverb }
  }

  const buildChain = (context: AudioContext, now: number, params: VoiceParams, peak: number, input: AudioNode) => {
    const target = voiceOutput(context)
    space ??= createSpace(context, target)

    const amp = context.createGain()
    amp.gain.setValueAtTime(0, now)
    amp.gain.linearRampToValueAtTime(params.gain * peak, now + params.attack)

    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(params.lpf, now)

    input.connect(filter).connect(amp).connect(target)
    const nodes: AudioNode[] = [filter]
    if (params.delay) {
      const send = context.createGain()
      send.gain.value = params.delay
      amp.connect(send).connect(space.delay)
      nodes.push(send)
    }
    if (params.room) {
      const send = context.createGain()
      send.gain.value = params.room
      amp.connect(send).connect(space.reverb)
      nodes.push(send)
    }
    return { amp, nodes }
  }

  const peakFor = (velocity: number) => Math.max(0.05, Math.min(1, velocity / 127))

  const startSynth = (context: AudioContext, note: number, velocity: number) => {
    const now = context.currentTime + 0.01
    const oscillator = context.createOscillator()
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(frequency(note), now)
    const { amp, nodes } = buildChain(context, now, SYNTH_VOICE, peakFor(velocity), oscillator)
    oscillator.start(now)
    sounding.set(note, { started: now, release: SYNTH_VOICE.release, amp, sources: [oscillator], nodes })
  }

  const instrumentIndex = (): Promise<SampleInstrument> => {
    loading ??= loadInstrument(solo).then(
      (loaded) => {
        instrument = loaded
        return loaded
      },
      (error: unknown) => {
        // Let a later note retry instead of caching the failure.
        loading = undefined
        throw error
      },
    )
    return loading
  }

  /**
   * A playable source for one note. A soundfont hands back its own buffer source,
   * already pitched and looping where the font loops - the same source the package's
   * trigger uses, except that this one can be stopped on key release. A sampled
   * instrument is fetched, decoded and rate-shifted from the nearest recorded pitch.
   */
  const buildSource = async (note: number, context: AudioContext): Promise<AudioBufferSourceNode> => {
    if (solo.font) return await soundfontNote(solo.font, note, context)

    const index = instrument ?? (await instrumentIndex())
    const { url, rate } = pickSample(index, note)
    const buffer = await loadBuffer(url)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    return source
  }

  const startSample = async (note: number, velocity: number) => {
    const context = getAudioContext()
    const source = await buildSource(note, context)
    // The key may have been released while the sound was loading.
    if (!enabled || !held.has(note)) {
      source.disconnect()
      return
    }

    const now = context.currentTime + 0.01
    const { amp, nodes } = buildChain(context, now, SAMPLE_VOICE, peakFor(velocity), source)
    source.start(now)
    sounding.set(note, { started: now, release: SAMPLE_VOICE.release, amp, sources: [source], nodes })
  }

  const release = (note: number, override?: number) => {
    const entry = sounding.get(note)
    if (!entry) return
    sounding.delete(note)

    let context: AudioContext
    try {
      context = getAudioContext()
    } catch {
      return
    }
    const now = context.currentTime
    const seconds = override ?? entry.release

    entry.amp.gain.cancelScheduledValues(now)
    entry.amp.gain.setValueAtTime(entry.amp.gain.value, now)
    entry.amp.gain.linearRampToValueAtTime(0, now + seconds)

    const finish = now + seconds + 0.02
    entry.sources.forEach((source) => source.stop(finish))
    const last = entry.sources[entry.sources.length - 1]
    if (last) {
      last.onended = () => {
        entry.sources.forEach((source) => source.disconnect())
        entry.amp.disconnect()
        entry.nodes.forEach((node) => node.disconnect())
      }
    }
  }

  return {
    setSolo: (id) => {
      solo = findInstrument(id)
      instrument = undefined
      loading = undefined
      // Let anything still sounding fade before the new instrument takes over.
      ;[...sounding.keys()].forEach((note) => release(note, 0.1))
    },
    preload: async (low, high) => {
      try {
        if (solo.font) {
          // Soundfonts are cached by font and pitch, so resolving each note of the range
          // leaves every key ready without a fetch on the first press.
          const context = getAudioContext()
          const notes = []
          for (let midi = Math.max(0, low); midi <= Math.min(127, high); midi += 1) notes.push(midi)
          await Promise.all(notes.map((midi) => loadSoundfontNote(solo.font as string, midi, context)))
          return notes.length
        }
        return await preloadRange(solo, low, high)
      } catch (error) {
        console.warn('[solo voice] preload failed', error)
        return 0
      }
    },
    setEnabled: (next) => {
      enabled = next
      if (!next) {
        held.clear()
        ;[...sounding.keys()].forEach((note) => release(note, 0.05))
      }
    },
    setLevel: (value) => {
      leadLevel = value
      // Applied immediately when the stage exists, so turning it up is heard on the note
      // being played rather than only on the next one.
      if (voiceOut) voiceOut.gain.value = value
    },
    monitor: () => {
      try {
        return voiceOutput(getAudioContext())
      } catch {
        // Nothing is unlocked yet; the caller tries again once audio is ready.
        return undefined
      }
    },
    allNotesOff: () => {
      held.clear()
      ;[...sounding.keys()].forEach((note) => release(note, 0.05))
    },
    release: (note) => {
      held.delete(note)
      release(note)
    },
    strike: (note, velocity) => {
      if (!enabled) return

      let context: AudioContext
      try {
        context = getAudioContext()
      } catch {
        return
      }
      if (context.state !== 'running') return

      held.add(note)
      // Retriggering a held key, or running out of polyphony, fades the old note.
      release(note, 0.02)
      if (sounding.size >= MAX_VOICES) {
        const oldest = [...sounding.values()].sort((a, b) => a.started - b.started)[0]
        const oldestNote = [...sounding.entries()].find(([, entry]) => entry === oldest)?.[0]
        if (oldestNote !== undefined) release(oldestNote, 0.05)
      }

      // Sampled first, with the oscillator as a fallback so a fetch failure is still audible.
      void startSample(note, velocity).catch((error: unknown) => {
        console.warn('[solo voice]', error)
        try {
          startSynth(getAudioContext(), note, velocity)
        } catch {
          /* audio not ready */
        }
      })
    },
  }
}
