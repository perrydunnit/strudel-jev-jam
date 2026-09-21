/**
 * `@strudel/soundfonts@1.3.0` ships no type declarations.
 *
 * It registers the General MIDI instruments (`gm_*`) as Strudel sounds. Note that
 * `@strudel/web` deliberately comments out `registerSoundfonts()` in its own
 * prebake, so nothing in the `gm_*` family exists until this package is called.
 */
declare module '@strudel/soundfonts' {
  export function registerSoundfonts(): void
  export function setSoundfontUrl(url: string): void
  export function loadSoundfont(url: string): unknown
  export function startPresetNote(...args: unknown[]): (time: number) => void
  /**
   * Decodes one note of a soundfont into a buffer source. Unlike the registered
   * Strudel sound - whose `stop` is a no-op, so its notes cannot be released - this
   * hands back a real `AudioBufferSourceNode` that can be stopped.
   */
  export function getFontBufferSource(
    name: string,
    value: { note?: string | number; freq?: number },
    context: AudioContext,
  ): Promise<AudioBufferSourceNode>
  export const soundfontList: {
    instruments: string[]
    drums: string[]
    instrumentNames: string[]
  }
}

/** Maps each `gm_*` sound name to the soundfont files behind it. */
declare module '@strudel/soundfonts/gm.mjs' {
  const variants: Record<string, string[]>
  export default variants
}
