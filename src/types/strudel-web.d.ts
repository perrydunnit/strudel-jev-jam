declare module '@strudel/web' {
  export function initStrudel(options?: { prebake?: () => unknown }): Promise<unknown>
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>
  export function hush(): void
  export function getAudioContext(): AudioContext
  /** Scheduler position in cycles; multiply by the cycle length for bar tracking. */
  export function getTime(): number
  /**
   * Registers a sample map (a strudel.json URL, or an inline map with a base URL).
   * Resolves once the map is registered; the audio files load lazily on first play.
   */
  export function samples(url: string | Record<string, unknown>, base?: string): Promise<unknown>
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
    /**
     * An orbit is per-layer output bus. Its `output` is a real GainNode fed by the
     * layers that set `.orbit(n)`, which is what makes per-part mute and solo possible.
     */
    getOrbit: (orbit: number, channels?: number[]) => { output: GainNode }
    getBus: (name: unknown) => unknown
  }

  /** Options shared by the two analyser views Strudel draws for its own scopes. */
  export type ScopeOptions = {
    ctx?: CanvasRenderingContext2D
    /** Which registered analyser to read. */
    id?: string | number
    color?: string
    thickness?: number
    scale?: number
    pos?: number
    min?: number
    max?: number
  }

  /**
   * The per-orbit analysers Strudel keeps. `analysers[id]` is undefined until something
   * on that id has sounded, which the scope renderers draw as a flat line.
   */
  export const analysers: Record<string | number, AnalyserNode | undefined>
  /** Creates (or returns) the analyser registered under an id. */
  export function getAnalyserById(
    id: string | number,
    fftSize?: number,
    smoothingTimeConstant?: number,
  ): AnalyserNode
  /** The most recent data for a registered analyser. */
  export function getAnalyzerData(type: 'time' | 'frequency', id?: string | number): Float32Array
  /** Oscilloscope in the time domain, drawn onto `ctx`. */
  export function drawTimeScope(analyser: AnalyserNode | undefined, options?: ScopeOptions): void
  /** Spectrum in the frequency domain, drawn onto `ctx`. */
  export function drawFrequencyScope(analyser: AnalyserNode | undefined, options?: ScopeOptions): void
}
