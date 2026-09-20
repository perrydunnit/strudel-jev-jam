declare module '@strudel/web' {
  export function initStrudel(options?: { prebake?: () => unknown }): Promise<unknown>
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>
  export function hush(): void
  export function getAudioContext(): AudioContext
  /**
   * Low-level trigger used by the scheduler. `deadline` and `duration` are in
   * seconds; `value` is the same object shape a pattern produces, e.g.
   * `{ note: 60, s: 'triangle' }`.
   *
   * Returns `undefined`, so a triggered note cannot be released early.
   */
  export function superdough(
    value: Record<string, unknown>,
    deadline: number,
    duration: number,
    cps?: number,
    t?: number,
  ): Promise<unknown>
  /**
   * The audio controller. Only these members exist in 1.3.0 - there is no
   * release/stop API. `output.destinationGain` is the master GainNode, so custom
   * graphs can connect there to share Strudel's master chain.
   */
  export function getSuperdoughAudioController(): {
    audioContext: AudioContext
    output: { destinationGain: GainNode }
    nodes: unknown
    buses: unknown
    reset: () => void
    duck: (...args: unknown[]) => void
    getOrbit: (name: unknown) => unknown
    getBus: (name: unknown) => unknown
  }
}
