import { getAudioContext, getSuperdoughAudioController } from '@strudel/web'
import type { Voice } from '../domain/music'

export type LiveVoice = {
  strike: (note: number, velocity: number) => void
  release: (note: number) => void
  allNotesOff: () => void
  setVoice: (voice: Voice) => void
  setEnabled: (enabled: boolean) => void
}

type Sounding = {
  started: number
  release: number
  amp: GainNode
  oscillators: OscillatorNode[]
  /** Filter and effect sends, disconnected once the note has faded. */
  nodes: AudioNode[]
}

type Space = { delay: AudioNode; reverb: AudioNode }

const MAX_VOICES = 16

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
export function createLiveVoice(initial: Voice): LiveVoice {
  let voice = initial
  let enabled = true
  const sounding = new Map<number, Sounding>()
  let master: AudioNode | undefined
  let space: Space | undefined

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
    entry.oscillators.forEach((oscillator) => oscillator.stop(finish))
    const last = entry.oscillators[entry.oscillators.length - 1]
    if (last) {
      last.onended = () => {
        entry.oscillators.forEach((oscillator) => oscillator.disconnect())
        entry.amp.disconnect()
        entry.nodes.forEach((node) => node.disconnect())
      }
    }
  }

  return {
    setVoice: (next) => {
      voice = next
    },
    setEnabled: (next) => {
      enabled = next
      if (!next) [...sounding.keys()].forEach((note) => release(note, 0.05))
    },
    allNotesOff: () => [...sounding.keys()].forEach((note) => release(note, 0.05)),
    release: (note) => release(note),
    strike: (note, velocity) => {
      if (!enabled) return

      let context: AudioContext
      try {
        context = getAudioContext()
      } catch {
        return
      }
      if (context.state !== 'running') return

      // Retriggering a held key, or running out of polyphony, fades the old note.
      release(note, 0.02)
      if (sounding.size >= MAX_VOICES) {
        const oldest = [...sounding.values()].sort((a, b) => a.started - b.started)[0]
        const oldestNote = [...sounding.entries()].find(([, entry]) => entry === oldest)?.[0]
        if (oldestNote !== undefined) release(oldestNote, 0.05)
      }

      const target = destination(context)
      space ??= createSpace(context, target)

      const now = context.currentTime + 0.01
      const level = Math.max(0.05, Math.min(1, velocity / 127))

      const amp = context.createGain()
      amp.gain.setValueAtTime(0, now)
      amp.gain.linearRampToValueAtTime(voice.gain * level, now + voice.attack)

      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(voice.lpf, now)
      if (voice.lpq) filter.Q.setValueAtTime(voice.lpq, now)

      const oscillator = context.createOscillator()
      const partials = voice.partials
      if (partials?.length) {
        const real = new Float32Array(partials.length + 1)
        const imag = new Float32Array(partials.length + 1)
        partials.forEach((amplitude, index) => {
          imag[index + 1] = amplitude
        })
        oscillator.setPeriodicWave(context.createPeriodicWave(real, imag))
      } else {
        oscillator.type = (voice.sound === 'user' ? 'triangle' : voice.sound) as OscillatorType
      }
      oscillator.frequency.setValueAtTime(frequency(note), now)

      oscillator.connect(filter).connect(amp).connect(target)

      const nodes: AudioNode[] = [filter]
      if (voice.delay) {
        const send = context.createGain()
        send.gain.value = voice.delay
        amp.connect(send).connect(space.delay)
        nodes.push(send)
      }
      if (voice.room) {
        const send = context.createGain()
        send.gain.value = voice.room
        amp.connect(send).connect(space.reverb)
        nodes.push(send)
      }

      oscillator.start(now)
      sounding.set(note, {
        started: now,
        release: voice.release,
        amp,
        oscillators: [oscillator],
        nodes,
      })
    },
  }
}
