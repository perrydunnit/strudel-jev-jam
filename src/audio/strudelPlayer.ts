import type { PatternPlan } from '../domain/music'
import { evaluate, hush, initStrudel } from '@strudel/web'

export type AudioStatus = 'offline' | 'ready' | 'playing'

export type StrudelPlayer = {
  status: () => AudioStatus
  start: (plan: PatternPlan) => Promise<void>
  stop: () => void
  applyDecision: (plan: PatternPlan) => Promise<void>
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
export function createStrudelPlayer(): StrudelPlayer {
  let currentStatus: AudioStatus = 'offline'
  let ready: Promise<unknown> | undefined

  const play = async (plan: PatternPlan) => {
    // initStrudel resolves once the synth registry and repl are ready. It has to be
    // invoked from a user gesture so the AudioContext is allowed to resume.
    ready ??= initStrudel()
    await ready
    await evaluate(plan.code)
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
  }
}
