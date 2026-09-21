/**
 * The invariants the arrangement has to satisfy.
 *
 * Every rule here exists because breaking it produced something that was wrong in a way
 * that was either hard to hear or expensive to find: a figure on a triplet grid, a phrase
 * of the wrong length, two styles sharing an instrument, a filter envelope with nothing to
 * move. They run at import and they throw, because a violation is a bug in the tables and
 * the tables are cheaper to check than the audio is to debug.
 *
 * The tables are *arguments* rather than imports. That keeps this module dependent on
 * nothing but the vocabulary, so it cannot take part in an import cycle, and it makes each
 * rule something a test can point at any set of styles.
 */
import { instrumentSound, findInstrument } from './samples'
import { openingChord } from './chords'
import type { Rhythm } from './figures'
import type { ChordBar, Style, StyleId } from './vocabulary'

/**
 * Every layer sits on a straight sixteenth grid, so a figure's slot count has to divide
 * `grid`. If it does not, the chord figure lands between the drum hits - a 3:2 polyrhythm -
 * and the drums sound like they are rushing or dragging against the chords. This caught a
 * real bug: slots of 3, 6 and 12 meant three of the four rhythms were triplets against
 * straight drum patterns.
 */
export function assertRhythmsDivideTheGrid(rhythms: Rhythm[], grid: number): void {
  rhythms.forEach((rhythm) => {
    if (grid % rhythm.slots !== 0) {
      throw new Error(`${rhythm.id} has ${rhythm.slots} slots in a bar, which does not divide ${grid}`)
    }
    rhythm.rests.forEach((rest) => {
      if (rest < 0 || rest >= rhythm.slots) throw new Error(`${rhythm.id} rests at ${rest}, outside its bar`)
    })
  })
}

/**
 * Every phrase is the same length, and the app depends on it: the phrase handoff is built
 * from two phrases, the halfway point is where a phrase turns, and a set that mixed four
 * and eight bar phrases would make both of those meaningless.
 */
export function assertPhrasesAreUniform(styles: Style[], phraseBars: number): void {
  styles.forEach((style) => {
    style.sequences.forEach((sequence) => {
      if (sequence.bars.length !== phraseBars) {
        throw new Error(`${sequence.id} is ${sequence.bars.length} bars, not ${phraseBars}`)
      }
    })
  })
}

/**
 * A filter envelope needs a cutoff to move. superdough builds the filter chain only when
 * one is set, and ignores the envelope controls entirely without it, so an envelope on a
 * layer with no `lpf` is silently nothing: a layer that looks like it should be moving and
 * is not. Refusing at import is cheaper than hearing it and wondering.
 */
export function assertFilterEnvelopesHaveCutoffs(styles: Style[]): void {
  styles.forEach((style) => {
    ([['bass', style.bass], ['pad', style.pad], ['figure', style.arpSound]] as const).forEach(([name, layer]) => {
      const shaped = layer.lpenv !== undefined || layer.lpa !== undefined
        || layer.lpd !== undefined || layer.lps !== undefined
      if (shaped && layer.lpf === undefined) {
        throw new Error(`${style.id}: the ${name} has a filter envelope but no cutoff, so the envelope would do nothing`)
      }
    })
  })
}

/**
 * An arrangement is one digit per bar of every phrase. The wrong length would slip against
 * the bars it is meant to shape, and one that never plays is not an arrangement but a layer
 * that should not be in the style at all.
 */
export function assertArrangementsAreWellFormed(styles: Style[], phraseBars: number): void {
  styles.forEach((style) => {
    Object.entries(style.arrangement).forEach(([layer, mask]) => {
      if (mask === undefined) return
      if (mask.length !== phraseBars) {
        throw new Error(`${style.id}: the ${layer} arrangement covers ${mask.length} bars, not ${phraseBars}`)
      }
      if (!/^[01]+$/.test(mask)) throw new Error(`${style.id}: the ${layer} arrangement is not 0s and 1s: "${mask}"`)
      if (!mask.includes('1')) throw new Error(`${style.id}: the ${layer} arrangement never plays`)
    })
  })
}

/**
 * A phrase has to develop, not repeat itself.
 *
 * These phrases were first written as "state it, then state it again", and half of them came
 * out as a four-bar loop played twice: nine of the sixteen repeated three of their four bars
 * between the halves, and they sounded like it. An eight-bar phrase is long enough to need a
 * second idea, so a half may echo the *framing* bars - the opening and the close - and no more
 * than that. Six of them now share nothing at all.
 */
export function assertPhrasesDevelop(styles: Style[]): void {
  styles.forEach((style) => {
    style.sequences.forEach((sequence) => {
      const half = sequence.bars.length / 2
      const ids = (bar: ChordBar) => (Array.isArray(bar) ? bar : [bar]).join('+')
      const repeated = Array.from({ length: half }, (_, index) => (
        ids(sequence.bars[index]) === ids(sequence.bars[index + half])
      )).filter(Boolean).length
      if (repeated > 2) {
        throw new Error(
          `${sequence.id} repeats ${repeated} of its ${half} bars between the halves, so it is a loop rather than a phrase`,
        )
      }
    })
  })
}

/**
 * The styles are meant to be self-contained, so nothing may be shared: not an instrument,
 * not a drum machine, and not a sequence. A duplicated instrument is how one style would
 * drift into another's sound, and two sequences opening on the same chord would make Jev's
 * next-chord candidates ambiguous.
 */
export function assertStyleIsolation(styles: Style[]): void {
  const owners = new Map<string, string>()
  const claim = (kind: string, value: string, style: StyleId) => {
    const key = `${kind}:${value}`
    const owner = owners.get(key)
    if (owner) throw new Error(`${value} is shared by ${owner} and ${style} (${kind})`)
    owners.set(key, style)
  }

  styles.forEach((style) => {
    const sounds: [string, string][] = [
      ['pad', instrumentSound(findInstrument(style.pad.instrument))],
      ['figure', instrumentSound(findInstrument(style.arpSound.instrument))],
      ['bass', instrumentSound(findInstrument(style.bass.instrument))],
      ...style.solos.map((id): [string, string] => ['lead', instrumentSound(findInstrument(id))]),
    ]
    sounds.forEach(([kind, sound]) => claim(kind, sound, style.id))
    claim('drums', `${style.drums.bank ?? 'uzu'}:${style.drums.pattern}`, style.id)
    claim('perc', `${style.perc.bank ?? 'uzu'}:${style.perc.pattern}`, style.id)

    if (!style.solos.includes(style.solo)) throw new Error(`${style.id} opens on a lead it does not offer`)
    const palette = new Set<string>(style.palette)
    const openings = new Set<string>()
    style.sequences.forEach((sequence) => {
      claim('sequence', sequence.id, style.id)
      sequence.bars.flat().forEach((chord) => {
        if (!palette.has(chord)) throw new Error(`${style.id}: ${chord} is in ${sequence.id} but not in its palette`)
      })
      const opening = openingChord(sequence)
      if (openings.has(opening)) throw new Error(`${style.id} has two sequences opening on ${opening}`)
      openings.add(opening)
    })
  })
}
