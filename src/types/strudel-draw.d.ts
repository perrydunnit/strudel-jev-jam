/**
 * `@strudel/draw` ships no types. These are the renderers the voice views use, taken from the
 * package's own source: `__pianoroll` is the low-level painter behind `.pianoroll()` and, with
 * `vertical: 1, labels: 1`, behind `.punchcard()`; `pitchwheel` draws the circular pitch view.
 *
 * The unbundled subpaths are imported rather than the package entry, because that entry is a
 * bundle carrying its own copy of `@strudel/core`.
 */
declare module '@strudel/draw/pianoroll.mjs' {
  export function __pianoroll(options: Record<string, unknown>): void
  /** Returns a painter `(ctx, time, haps, drawTime)` for a punchcard. */
  export function getPunchcardPainter(options?: Record<string, unknown>): (...args: unknown[]) => void
}

declare module '@strudel/draw/pitchwheel.mjs' {
  export function pitchwheel(options: Record<string, unknown>): void
}
