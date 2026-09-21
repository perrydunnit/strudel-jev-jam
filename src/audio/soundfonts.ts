import { getFontBufferSource } from '@strudel/soundfonts'
import variants from '@strudel/soundfonts/gm.mjs'

/**
 * The General MIDI family.
 *
 * `@strudel/web@1.3.0` comments `registerSoundfonts()` out of its own prebake, so
 * none of these names exist until `registerSoundfonts()` is called. Two consequences
 * shape everything below:
 *
 * 1. A registered soundfont note cannot be released - its trigger returns a no-op
 *    `stop` - which is why the live solo voice reads the raw font buffer instead and
 *    builds its own envelope. `getFontBufferSource` hands back a real
 *    `AudioBufferSourceNode`, so note-off is honoured.
 * 2. A soundfont trigger ignores `gain`, because its ADSR is fixed, so warming one
 *    with `superdough(..., { gain: 0 })` is not necessarily silent. Resolving the
 *    buffer without ever calling `start()` is, and it populates the same cache.
 *
 * Each `gm_` name maps to several font files that differ only in which SoundFont
 * bank they came from. `s("gm_x")` plays the first one (an absent `n` resolves to
 * index 0), so this module always uses index 0 as well and the two agree.
 */

export const GENERAL_MIDI = 'gm_'

/** True for a General MIDI soundfont name rather than a sample-map name. */
export function isSoundfont(name: string): boolean {
  return name.split(':')[0].startsWith(GENERAL_MIDI)
}

/** The font file a `gm_` name resolves to, or undefined if it is not one. */
export function fontFor(name: string): string | undefined {
  return variants[name]?.[0]
}

/** Every `gm_` name the package can register, for guarding configuration. */
export function soundfontNames(): string[] {
  return Object.keys(variants)
}

/**
 * Decodes one note of a soundfont without playing it.
 *
 * The returned source is never started, so this is silent; that makes it the preload
 * path for soundfont-backed sounds. Once resolved, the buffer is cached inside the
 * package, keyed by font and pitch, so a later strike is immediate.
 */
export async function loadSoundfontNote(
  name: string,
  note: number | string,
  context: AudioContext,
): Promise<void> {
  const font = fontFor(name)
  if (!font) throw new Error(`${name} is not a General MIDI instrument`)
  const source = await getFontBufferSource(font, { note }, context)
  // Nothing was started, so there is nothing to stop; release the reference only.
  source.disconnect?.()
}

/**
 * A playable soundfont note for the custom live voice, which needs to stop it on
 * key release.
 */
export async function soundfontNote(
  name: string,
  midi: number,
  context: AudioContext,
): Promise<AudioBufferSourceNode> {
  const font = fontFor(name)
  if (!font) throw new Error(`${name} is not a General MIDI instrument`)
  return await getFontBufferSource(font, { note: midi }, context)
}
