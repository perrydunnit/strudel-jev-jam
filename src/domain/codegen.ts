/**
 * Turning the model into Strudel source text.
 *
 * Every function here returns a fragment of the program: a voice's chain, the notes of a
 * bass figure, the mask for a layer's presence. Keeping the emission in one place is what
 * lets the pattern builder read as an outline of the arrangement rather than as a pile of
 * string concatenation, and it is the only module that knows what the output language
 * looks like.
 *
 * Nothing here decides anything musical. When a value is absent the fragment is absent,
 * so a style says what it wants and this says how to write it.
 */
import { findInstrument, instrumentSound } from './samples'
import type { Sound, StyleLayer } from './vocabulary'

/**
 * How loose each layer plays.
 *
 * An exactly quantised drum machine is the most recognisable mark of machine-made music:
 * every hit lands on the grid to the sample, and every hit is exactly as loud as the last.
 * A player does neither, and the difference is small enough that it reads as playing rather
 * than as a mistake.
 *
 * `timing` is in the seconds the sound is shifted by, and `velocity` is how far below full
 * the level variation reaches.
 *
 * `rand` is sampled at each event's own onset and is a function of the absolute cycle time,
 * so a hit differs from its neighbours and a bar differs from the last time it came round.
 * That is what makes this feel rather than a shuffle that repeats every bar.
 *
 * Timing is only set on the two drum layers, and deliberately: `nudge` is read by the sample
 * player and ignored by the synths, so on a pitched sample it would be luck and on an
 * oscillator it would be nothing. The drums are the layer that needs it most anyway.
 *
 * The pad is not listed at all. It is the bed, and a bed whose level wobbles is a pumping bed.
 */
const FEEL: Partial<Record<'drums' | 'perc' | 'bass' | 'chords', { timing?: number; velocity?: number }>> = {
  drums: { timing: 0.004, velocity: 0.12 },
  perc: { timing: 0.007, velocity: 0.24 },
  bass: { velocity: 0.08 },
  chords: { velocity: 0.14 },
}

/** How loose a layer plays, as chain fragments. Empty when it plays dead straight. */
export function feelCode(layer: keyof typeof FEEL): string {
  const feel = FEEL[layer]
  if (!feel) return ''
  const parts: string[] = []
  if (feel.timing) parts.push(`nudge(rand.range(-${feel.timing}, ${feel.timing}))`)
  if (feel.velocity) parts.push(`velocity(rand.range(${(1 - feel.velocity).toFixed(2)}, 1))`)
  return parts.length ? `.${parts.join('.')}` : ''
}

/**
 * A layer's presence across the phrase, as a chain fragment.
 *
 * `mask` keeps the pattern's own structure and only drops the events whose mask value is
 * falsy, so this silences whole bars without moving a note inside the bars that remain.
 * The mask is one value per cycle, and one cycle is one bar.
 */
export function maskCode(mask: string | undefined): string {
  return mask?.includes('0') ? `.mask("<${mask.split('').join(' ')}>")` : ''
}

/** The bars a layer sits out, for the panel. Empty when it plays throughout. */
export function describePresence(mask: string | undefined): string {
  const out = mask?.split('').flatMap((digit, index) => (digit === '0' ? [index + 1] : [])) ?? []
  if (!out.length) return ''
  // A run of consecutive bars reads as a range: "out in bars 3-6", not "3 and 4 and 5 and 6".
  const runs: string[] = []
  out.forEach((bar) => {
    const last = runs[runs.length - 1]
    const previous = last ? Number(last.split('-').pop()) : NaN
    if (previous && bar === previous + 1) runs[runs.length - 1] = `${last.split('-')[0]}-${bar}`
    else runs.push(`${bar}`)
  })
  return `out in bar${out.length > 1 ? 's' : ''} ${runs.join(' and ')}`
}

/** One superdough voice's chain, from its sound and its tone settings. */
export function soundCode(sound: Sound): string {
  const parts = [sound.sample ? `s("${sound.sample}")` : `s("${sound.synth ?? 'sawtooth'}")`]
  if (sound.partials) parts.push(`partials([${sound.partials.join(',')}])`)
  if (sound.detune !== undefined) parts.push(`detune(${sound.detune})`)
  if (sound.lpf) parts.push(`lpf(${sound.lpf})`)
  if (sound.lpq) parts.push(`lpq(${sound.lpq})`)
  if (sound.lpenv) parts.push(`lpenv(${sound.lpenv})`)
  if (sound.lpa !== undefined) parts.push(`lpa(${sound.lpa})`)
  if (sound.lpd !== undefined) parts.push(`lpd(${sound.lpd})`)
  if (sound.lps !== undefined) parts.push(`lps(${sound.lps})`)
  if (sound.attack !== undefined) parts.push(`attack(${sound.attack})`)
  if (sound.release !== undefined) parts.push(`release(${sound.release})`)
  if (sound.room) parts.push(`room(${sound.room})`)
  if (sound.delay) parts.push(`delay(${sound.delay})`, `delaytime(0.3)`, `delayfeedback(0.4)`)
  if (sound.distort) parts.push(`distort(${sound.distort})`)
  if (sound.gain !== undefined) parts.push(`gain(${sound.gain})`)
  return parts.join('.')
}

/** The superdough voice for a layer: this style's instrument plus its tone settings. */
export function layerSound(layer: StyleLayer): Sound {
  const instrument = findInstrument(layer.instrument)
  return {
    // A sample or a soundfont; an oscillator pad leaves its name in `synth` instead.
    sample: instrument.font ?? instrument.sample,
    synth: instrument.synth,
    // A built-in waveform is a shape, not a timbre, so an additive instrument carries the
    // spectrum that makes it one.
    partials: instrument.partials,
    detune: layer.detune,
    lpf: layer.lpf,
    lpq: layer.lpq,
    lpenv: layer.lpenv,
    lpa: layer.lpa,
    lpd: layer.lpd,
    lps: layer.lps,
    attack: layer.attack,
    release: layer.release,
    room: layer.room,
    delay: layer.delay,
    distort: layer.distort,
    gain: layer.gain,
  }
}

/** The readable name of the instrument a layer plays. */
export function layerLabel(layer: StyleLayer): string {
  const instrument = findInstrument(layer.instrument)
  return `${instrument.label} · ${instrumentSound(instrument)}`
}

/** `1` `3` `5` are chord tones, `8` is the bass an octave up, `~` is a rest. */
export function bassSteps(template: string, chord: string[], root: string, rootUp: string): string[] {
  return template.split(/\s+/).map((token) => {
    if (token === '1') return root
    if (token === '3') return chord[1] ?? root
    if (token === '5') return chord[2] ?? root
    if (token === '8') return rootUp
    return '~'
  })
}

/**
 * `[a b]` groups one bar. A bar holding two chords nests one group per chord, so
 * both halves stay aligned with the layers around them.
 */
export function group(perChord: string[][]): string {
  const parts = perChord.map((tokens) => `[${tokens.join(' ')}]`)
  return parts.length === 1 ? parts[0] : `[${parts.join(' ')}]`
}
