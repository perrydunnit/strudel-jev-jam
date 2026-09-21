import { LAYER_ORBITS, type LayerId } from '../domain/vocabulary'
import type { PatternPlan, PlanSound } from '../domain/pattern'
import { SAMPLE_PACK_URLS } from '../domain/samples'
import { registerSoundfonts } from '@strudel/soundfonts'
import {
  evaluate,
  getAnalyserById,
  getAudioContext,
  getSuperdoughAudioController,
  getTime,
  hush,
  initStrudel,
  samples,
  superdough,
} from '@strudel/web'
import { isSoundfont, loadSoundfontNote } from './soundfonts'

export type AudioStatus = 'offline' | 'ready' | 'playing'

/** One scheduled note, as Strudel's own renderers read it. */
export type VoiceHap = {
  whole: { begin: { valueOf: () => number }; end: { valueOf: () => number } }
  part?: unknown
  duration?: unknown
  value: Record<string, unknown>
  hasTag?: (tag: string) => boolean
}

/** The part of a Strudel pattern the views use. The package ships no types. */
type PatternSource = { queryArc: (from: number, to: number) => VoiceHap[] }

/**
 * A constant control arrives as a plain value, but a signal-backed one stays wrapped, so
 * read either. Only `orbit` is read this way, and it is always a constant here.
 */
const readControl = (value: unknown): unknown =>
  value && typeof value === 'object' && 'value' in value ? (value as { value: unknown }).value : value

export type StrudelPlayer = {
  status: () => AudioStatus
  /** Initialises Strudel. Must run inside a user gesture. */
  prepare: () => Promise<unknown>
  start: (plan: PatternPlan) => Promise<void>
  stop: () => void
  applyDecision: (plan: PatternPlan) => Promise<void>
  /** Scheduler position in cycles, so a sequence's bar can be tracked accurately. */
  cycleNow: () => number
  /**
   * Sets the level of each pattern layer, 1 for playing and 0 for silent.
   *
   * Muting is done on the orbit's own gain node rather than by rebuilding the pattern
   * with different gains. Rebuilding would re-evaluate the program to change a mixer
   * setting, and a layer silenced that way would still be scheduled - the notes would
   * be there, just at zero. This way a part stops on the note it is already ringing,
   * and the phrase carries on exactly where it was.
   */
  setLayerGains: (gains: Partial<Record<LayerId, number>>) => void
  /**
   * Scheduler position in cycles, unrounded: the scrolling views need the fractional
   * position to place their playhead, where the bar counter needs the whole cycle.
   */
  timeNow: () => number
  /**
   * What one layer will play around now, taken from the running pattern rather than from
   * the plan, so a view shows the notes the scheduler is really about to trigger. Each
   * layer plays in its own orbit, which is what identifies its haps.
   */
  voiceHaps: (orbit: number, cycles: number) => VoiceHap[]
  /**
   * Strudel's analyser for an id, so its own scope and spectrum renderers can read it.
   * `source` is connected into it, which is how the live voice - not a Strudel pattern,
   * so not something `.analyze` can reach - gets one.
   */
  analyser: (id: number, source?: AudioNode) => AnalyserNode | undefined
  /**
   * Prepares sounds silently so nothing waits on the network later, and resolves to
   * how many were newly prepared. Safe to call repeatedly: each sound is done once.
   */
  warm: (sounds: PlanSound[]) => Promise<number>
}

/**
 * `plan.code` is generated only from the allowlisted tables in `domain/music.ts`,
 * so no model output ever reaches `evaluate()` as executable source.
 *
 * Two Strudel pitfalls are handled upstream in that builder:
 * - Pitch must go through `note()`, never `n()`: for synth sounds superdough
 *   resolves harmonics from `partials ?? n`, so note names passed to `n()` reach
 *   `new Float32Array(value)`, produce a zero-length array, and make
 *   `createPeriodicWave` throw "the real array ... (1) is less than the
 *   minimum bound (2)".
 * - `evaluate()` autoplays, so no trailing `.play()` is needed.
 */
export function createStrudelPlayer(onNotice?: (message: string) => void): StrudelPlayer {
  let currentStatus: AudioStatus = 'offline'
  let ready: Promise<unknown> | undefined
  /** The pattern the scheduler is running, kept for the voice views. */
  let pattern: PatternSource | undefined
  /** Sound keys already prepared, so warming is done once per sound rather than per plan. */
  const warmed = new Set<string>()

  const initialise = () => {
    // Runs from a user gesture so the AudioContext may resume. A pack that fails to
    // load is not fatal: the affected layers fall back to the built-in synths.
    ready ??= (async () => {
      const failed: string[] = []
      await initStrudel({
        prebake: async () => {
          // `@strudel/web` comments registerSoundfonts() out of its own prebake, so
          // without this call the entire `gm_*` family is unregistered and every
          // `s("gm_...")` plays nothing at all. Registration only records how to load
          // each font; the font files themselves are fetched on first use.
          registerSoundfonts()
          await Promise.all(
            SAMPLE_PACK_URLS.map(async (url) => {
              try {
                await samples(url)
              } catch (error) {
                failed.push(url)
                console.warn('[samples] could not load', url, error)
              }
            }),
          )
          if (failed.length) onNotice?.(`${failed.length} sound pack(s) unavailable - using synth fallbacks`)
        },
      })
    })()
    return ready
  }

  const play = async (plan: PatternPlan) => {
    await initialise()
    const evaluated = await evaluate(plan.code)
    // The repl resolves to the pattern it just set. Keeping it is what lets a view ask what
    // a layer is about to play instead of re-deriving it from the plan.
    pattern = evaluated && typeof evaluated === 'object' && 'pattern' in evaluated
      ? (evaluated as { pattern: PatternSource }).pattern
      : (evaluated as PatternSource | undefined)
    currentStatus = 'playing'
  }

  return {
    status: () => currentStatus,
    start: (plan) => play(plan),
    stop: () => {
      hush()
      currentStatus = 'offline'
    },
    applyDecision: async (plan) => {
      if (currentStatus !== 'playing') return
      await play(plan)
    },
    cycleNow: () => {
      try {
        return Math.floor(getTime())
      } catch {
        return 0
      }
    },
    timeNow: () => {
      try {
        return getTime()
      } catch {
        return 0
      }
    },
    voiceHaps: (orbit, cycles) => {
      if (!pattern) return []
      try {
        const now = getTime()
        const from = now - cycles / 2
        // A layer is identified by its orbit: it is what the mixer gains and the views share.
        return pattern
          .queryArc(from, from + cycles)
          .filter((hap) => Number(readControl(hap.value?.orbit)) === orbit)
      } catch {
        return []
      }
    },
    analyser: (id, source) => {
      try {
        const analyser = getAnalyserById(id)
        source?.connect(analyser)
        return analyser
      } catch {
        return undefined
      }
    },
    prepare: () => initialise(),
    setLayerGains: (gains) => {
      let context: AudioContext
      let controller: ReturnType<typeof getSuperdoughAudioController>
      try {
        context = getAudioContext()
        controller = getSuperdoughAudioController()
      } catch {
        // Strudel is not initialised yet; the levels are applied again once it is.
        return
      }
      const now = context.currentTime
      Object.entries(gains).forEach(([id, volume]) => {
        const orbit = LAYER_ORBITS[id as Exclude<LayerId, 'solo'>]
        if (orbit === undefined || volume === undefined) return
        try {
          // A short ramp rather than a jump, so muting does not click.
          const gain = controller.getOrbit(orbit).output.gain
          gain.cancelScheduledValues(now)
          gain.setValueAtTime(gain.value, now)
          gain.linearRampToValueAtTime(volume, now + 0.04)
        } catch (error) {
          console.warn('[layer] could not set level', id, error)
        }
      })
    },
    warm: async (sounds) => {
      await initialise()
      const context = getAudioContext()
      // A plan lists one entry per bar, per chord and per note, and is rebuilt on every
      // decision, so it repeats heavily. Preparing each distinct sound once keeps the
      // work proportional to the instruments in use rather than to the plan's length.
      const pending = sounds.filter((sound) => {
        const key = `${sound.name}|${sound.bank ?? ''}|${sound.note ?? ''}`
        if (warmed.has(key)) return false
        warmed.add(key)
        return true
      })

      let prepared = 0
      await Promise.all(
        pending.map(async (sound, index) => {
          try {
            if (isSoundfont(sound.name)) {
              // A soundfont trigger ignores `gain` because its ADSR is fixed, so warming
              // one through superdough would not be silent. Resolving the buffer without
              // ever starting it is, and it fills the cache the trigger reads from.
              await loadSoundfontNote(sound.name, sound.note ?? 60, context)
            } else {
              // gain 0 keeps this silent while still forcing the sample to be cached.
              await superdough(
                { s: sound.name, bank: sound.bank, note: sound.note, gain: 0 },
                context.currentTime + 0.2 + index * 0.08,
                0.02,
              )
            }
          } catch (error) {
            // A fetch slower than its deadline is reported as "cannot schedule sounds in
            // the past". By then the sample is cached, so only real failures matter.
            if (!String(error).includes('past')) {
              console.warn('[warm] could not prepare', sound.name, error)
              return
            }
          }
          prepared += 1
        }),
      )
      return prepared
    },
  }
}
