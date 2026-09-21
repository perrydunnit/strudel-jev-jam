/**
 * The four arrangements.
 *
 * Each one is a complete, closed set: its own phrases, its own chord palette, its own drum
 * machine, and its own pad, figure, bass and leads. Nothing is shared between styles, which
 * is what stops a choice inside one style from turning it into another.
 *
 * This file is data, and it is meant to read as a table. The rules that keep it honest are
 * in `validate.ts` and run at the bottom of this module, so a broken table cannot reach
 * playback.
 *
 * Drum names come from tidal-drum-machines via `.bank()`; VCSL names are used directly.
 * Each style also uses a *different* machine, so even the drum kits are exclusive.
 *
 * The bass is a real bass instrument rather than an oscillator. Soundfont bass is safe
 * here because its fixed peak lands at the same level the filtered sawtooth and square
 * basses sat at, and a picked, fingered or upright bass is worth far more musically.
 */
import { DEFAULT_SOLO_RANGE } from './samples'
import { rhythms } from './figures'
import { PHRASE_BARS, type Selection, type Sequence, type SequenceId, type Style, type StyleId } from './vocabulary'
import {
  assertArrangementsAreWellFormed,
  assertFilterEnvelopesHaveCutoffs,
  assertPhrasesAreUniform,
  assertPhrasesDevelop,
  assertRhythmsDivideTheGrid,
  assertStyleIsolation,
} from './validate'

export const styles: Style[] = [
  {
    id: 'night-drive',
    label: 'Night drive',
    description: '909 house · picked bass · clav figures · Rhodes lead',
    // Starts on the tonic, the subdominant, the flat sixth or a minor two-five.
    sequences: [
      {
        id: 'night-drive/cadence',
        label: 'Canon',
        effect: 'The canon progression in minor: tonic, dominant, flat sixth, relative major, subdominant, tonic, half-diminished two, dominant. Eight bars that turn back on themselves, over the stepwise bass that has carried so much music.',
        bars: ['i', 'V7', 'VI', 'III', 'iv', 'i', ['ii\u00f87', 'V7'], 'i'],
      },
      {
        id: 'night-drive/open',
        label: 'Marusa',
        effect: 'The Marusa progression - the city pop and neo-soul signature - answered by the Komuro progression of the same decade. Submediant, dominant with its raised seventh, tonic, relative major; then back to the submediant and down through the subdominant.',
        bars: ['VI', 'V7', 'i', 'III', 'VI', 'iv', 'V7', 'i'],
      },
      {
        id: 'night-drive/push',
        label: 'Reverse loop',
        effect: 'The reverse loop - two-five, tonic, submediant - answered by the canon, whose half-diminished two and dominant are the same two-five arriving from the other side. Root movement in fourths sits at the front of each half, which is why it drives harder than a plain four-five.',
        bars: ['ii\u00f87', 'V7', 'i', 'VI', 'iv', 'i', ['ii\u00f87', 'V7'], 'i'],
      },
      {
        id: 'night-drive/twofive',
        label: 'Komuro turn',
        effect: 'The Komuro progression turned to start on its own subdominant, so the phrase opens away from home and walks back to the tonic; the second half is the canon, which closes on the dominant and hands on to whatever comes next.',
        bars: ['iv', 'V7', 'i', 'VI', 'i', 'V7', 'VI', 'III'],
      },
    ],
    palette: ['i', 'i64', 'III', 'iv', 'V7', 'VI', 'VII', 'ii\u00f87'],
    drums: { pattern: 'bd*4, ~ cp ~ cp', bank: 'RolandTR909', gain: 0.8, lpf: 12000 },
    perc: { pattern: '[~ oh]*2, [~ hh]*4', bank: 'RolandTR909', gain: 0.34 },
    // A picked bass: the envelope opens the filter for the first fifth of a second, which
    // is the click of the plectrum, and then settles back to the body of the note.
    bass: { instrument: 'bass-pick', template: '1 ~ 1 1 ~ 1 1 ~', lpf: 800, lpenv: 1.6, lpa: 0.004, lpd: 0.16, lps: 0.18, lpq: 6, release: 0.16, gain: 0.5 },
    // The pad opens over most of a second, so a held chord brightens as it sounds instead
    // of sitting there as one static block of colour.
    pad: { instrument: 'pad-saw', lpf: 1600, lpenv: 1.5, lpa: 0.9, lpd: 0.7, lps: 0.7, lpq: 2, attack: 0.5, release: 0.7, room: 0.5, gain: 0.17 },
    // The figure is a clav, so its envelope is a pluck: open immediately, gone in a sixth.
    arpSound: { instrument: 'clavisynth', lpf: 6500, lpenv: 1.1, lpa: 0.003, lpd: 0.16, lps: 0.3, lpq: 3, attack: 0.004, release: 0.5, room: 0.4, gain: 0.4 },
    //            bars  12345678
    // The figure steps out at the halfway point, which leaves a hole the pad covers; the
    // percussion drops for the last bar, so the drums are left exposed for the turnaround.
    arrangement: { perc: '11111110', chords: '11110111' },
    solos: ['rhodes', 'clean-guitar', 'flute', 'wineglass', 'kalimba'],
    solo: 'rhodes',
  },
  {
    id: 'broken-beat',
    label: 'Broken beat',
    description: 'MPC garage kit · fingered bass · FM piano figures · jazz guitar lead',
    sequences: [
      {
        id: 'broken-beat/smooth',
        label: 'Marusa loop',
        effect: 'The Marusa progression with sevenths, answered by the 1625 loop: submediant, dominant, tonic, relative major; then the tonic seventh, the submediant, the half-diminished two and the dominant. Two standard urban-garage shapes spliced.',
        bars: ['VI', 'V7', 'i', 'III', 'i7', 'VI', ['ii\u00f87', 'V7'], 'i'],
      },
      {
        id: 'broken-beat/cliche',
        label: 'Line cliche',
        effect: 'The minor line cliche: the bass walks down a semitone at a time under a held tonic before the dominant arrives, and the second half turns the tonic into the dominant of the subdominant, which is the fastest way to make a phrase ache.',
        bars: ['i', 'imaj7', 'i7', 'V7', 'iv', 'V7/iv', 'iv7', 'i'],
      },
      {
        id: 'broken-beat/backdoor',
        label: 'Back door',
        effect: 'The back-door cadence - subdominant, flat seventh with its seventh, home - stated plainly and then left for the submediant. The second half approaches it again through the 1645 loop in sevenths, and this time stays.',
        bars: ['iv', 'VII7', 'i', 'VI', 'i7', 'VI', 'iv7', 'V7'],
      },
      {
        id: 'broken-beat/lift',
        label: 'Andalusian',
        effect: 'The Andalusian fall from the flat seventh down to the dominant and home, then the 1645 loop in sevenths. The descent is the oldest minor sequence there is, and here it hands over to a modern urban turnaround.',
        bars: ['VII7', 'VI', 'V7', 'i', 'i7', 'VI', 'iv7', 'V7'],
      },
    ],
    palette: ['i', 'i7', 'imaj7', 'iv', 'iv7', 'IV', 'III', 'VI', 'VII7', 'V7', 'V7/iv', 'ii\u00f87'],
    drums: { pattern: 'bd*2 [~ bd] [bd ~], sd, [~ sd] sd:1', bank: 'AkaiMPC60', gain: 0.78, lpf: 11000 },
    perc: { pattern: '[~ hh:2]*4, rim', bank: 'AkaiMPC60', gain: 0.36 },
    // A fingered bass, so a softer envelope than the picked one: less click, more bloom.
    bass: { instrument: 'bass-finger', template: '1 ~ ~ 1 5 ~ 1 ~', lpf: 1100, lpenv: 1.5, lpa: 0.004, lpd: 0.2, lps: 0.22, lpq: 5, release: 0.22, gain: 0.46 },
    pad: { instrument: 'pad-square', lpf: 1400, lpenv: 1.3, lpa: 0.7, lpd: 0.6, lps: 0.65, lpq: 2, attack: 0.3, release: 0.6, room: 0.45, gain: 0.15 },
    // FM piano: the envelope closes quickly, so each figure note has a struck attack and a
    // short tail rather than ringing into the next one.
    arpSound: { instrument: 'fmpiano', lpf: 6500, lpenv: 1, lpa: 0.003, lpd: 0.22, lps: 0.3, lpq: 3, attack: 0.004, release: 0.5, room: 0.35, gain: 0.4 },
    //            bars  12345678
    // The percussion answers the kick rather than doubling it, so it waits for bar 2; the
    // figure drops out for the last bar of the phrase to make room for the turnaround.
    arrangement: { perc: '01111111', chords: '11111101' },
    solos: ['jazz-guitar', 'dantranh', 'marimba', 'glockenspiel', 'voice-oohs'],
    solo: 'jazz-guitar',
  },
  {
    id: 'slow-bloom',
    label: 'Slow bloom',
    description: '808 kit · synth sub · psaltery figures · harp lead',
    sequences: [
      {
        id: 'slow-bloom/drift',
        label: 'Andalusian',
        effect: 'The Andalusian descent - tonic, flat seventh, flat sixth - with the dominant left suspended rather than resolved, answered by the descending-bass progression turned to open on the submediant. It never reaches a leading tone.',
        bars: ['i', 'VII', 'VI', 'V7sus4', 'VI', 'III', 'i', 'VII'],
      },
      {
        id: 'slow-bloom/descent',
        label: 'Descending bass',
        effect: 'The descending-bass progression turned to open on the relative major, then the Andalusian descent with its dominant left suspended. Every chord here is diatonic to the natural minor, which is what lets the phrase hover instead of closing.',
        bars: ['III', 'i', 'VII', 'VI', 'i', 'VII', 'VI', 'V7sus4'],
      },
      {
        id: 'slow-bloom/major',
        label: 'Komuro',
        effect: 'The Komuro progression with the dominant left suspended instead of resolved, answered by the descending-bass progression. The submediant opens the phrase and the relative major closes it.',
        bars: ['VI', 'iv', 'V7sus4', 'i', 'i', 'VII', 'VI', 'III'],
      },
      {
        id: 'slow-bloom/hover',
        label: 'Modal loop',
        effect: 'The minor modal loop - relative major, flat seventh, tonic, flat sixth - turned to begin on its flat seventh, answered by the Andalusian descent, which settles on the suspended dominant rather than closing.',
        bars: ['VII', 'i', 'VI', 'III', 'i', 'VII', 'VI', 'V7sus4'],
      },
    ],
    palette: ['i', 'III', 'iv', 'VI', 'VII', 'V7sus4'],
    drums: { pattern: 'bd(1,4)', bank: 'RolandTR808', gain: 0.65, lpf: 7000 },
    perc: { pattern: 'rim(3,8), sh(5,8)', bank: 'RolandTR808', gain: 0.3 },
    // A synth sub that blooms: the filter takes four tenths of a second to open, so the
    // note arrives as weight and then gains definition, rather than starting bright.
    bass: { instrument: 'bass-synth', template: '1 ~ ~ ~ ~ ~ ~ ~', lpf: 500, lpenv: 2.4, lpa: 0.4, lpd: 0.8, lps: 0.5, lpq: 3, release: 1.4, gain: 0.5 },
    // The whole point of this style is the pad, so its envelope is the longest here: two
    // octaves of opening over a second, matching the pad's own slow amplitude attack.
    pad: { instrument: 'pad-triangle', lpf: 900, lpenv: 2, lpa: 1, lpd: 1.4, lps: 0.8, lpq: 2, attack: 1.2, release: 1.2, room: 0.7, gain: 0.2 },
    arpSound: { instrument: 'psaltery', lpf: 4500, lpenv: 1.4, lpa: 0.004, lpd: 0.3, lps: 0.3, lpq: 3, attack: 0.01, release: 1, room: 0.55, gain: 0.34 },
    //            bars  12345678
    // The figure states the harmony at each end of the phrase and then hands the middle to
    // the pad; the percussion arrives halfway, which is the only thing that changes here.
    arrangement: { perc: '00001111', chords: '11000011' },
    solos: ['harp', 'vibraphone', 'tubularbells', 'handchimes', 'ocarina'],
    solo: 'harp',
  },
  {
    id: 'after-hours',
    label: 'After-hours jazz',
    description: 'R-8 brushed kit · upright bass · balafon comping · piano lead',
    sequences: [
      {
        id: 'after-hours/twofive',
        label: 'Minor two-five',
        effect: 'The reverse loop - two-five, tonic, submediant - answered by the plain minor two-five, which resolves and stays home. The oldest cadence in jazz, stated in both directions.',
        bars: ['ii\u00f87', 'V7', 'i', 'VI', 'i', 'iv', 'V7', 'i'],
      },
      {
        id: 'after-hours/standard',
        label: 'Turnaround',
        effect: 'The standard turnaround and its own reverse, which is the same four chords read backwards: tonic, submediant, half-diminished two, dominant; then the two-five, the tonic and the submediant. It ends open, so the phrase keeps turning over.',
        bars: ['i', 'VI', 'ii\u00f87', 'V7', 'ii\u00f87', 'V7', 'i', 'VI'],
      },
      {
        id: 'after-hours/dark',
        label: 'Neapolitan',
        effect: 'The Neapolitan cadence: the subdominant, the Neapolitan in first inversion so its bass holds while the flat sixth falls to the dominant, then home. The second half is the standard turnaround, left open on the dominant.',
        bars: ['iv', 'bII', 'V7', 'i', 'i', 'VI', 'ii\u00f87', 'V7'],
      },
      {
        id: 'after-hours/descent',
        label: 'Andalusian fall',
        effect: 'The Andalusian fall from the flat seventh down to the dominant and home, then the Neapolitan cadence, which reaches the same resolution from a semitone above the tonic. Two of the oldest descents in the minor, one after the other.',
        bars: ['VII', 'VI', 'V7', 'i', 'iv', 'bII', 'V7', 'i'],
      },
    ],
    palette: ['i', 'ii\u00f87', 'iv', 'V7', 'VI', 'VII', 'bII'],
    drums: { pattern: 'bd(1,4), rd(5,8)', bank: 'RolandR8', gain: 0.55, lpf: 9000 },
    perc: { pattern: 'rim(3,8)', bank: 'RolandR8', gain: 0.4 },
    // An upright has no plectrum and no pickup, so the envelope barely opens: enough to
    // shape the note, not enough to sound electric.
    bass: { instrument: 'bass-upright', template: '1 ~ 3 ~ 5 ~ 8 ~', lpf: 1600, lpenv: 1.3, lpa: 0.02, lpd: 0.35, lps: 0.3, lpq: 2, release: 0.35, gain: 0.5 },
    // A quiet organ that opens slowly. Being a sample rather than an oscillator is the one
    // thing this style does differently to the others, and the envelope shapes it the same way.
    pad: { instrument: 'pipeorgan_quiet', lpf: 1200, lpenv: 1.4, lpa: 1, lpd: 1, lps: 0.75, lpq: 2, attack: 1, release: 1, room: 0.45, gain: 0.13 },
    arpSound: { instrument: 'balafon', lpf: 5000, lpenv: 1.2, lpa: 0.003, lpd: 0.25, lps: 0.25, lpq: 3, attack: 0.004, release: 0.45, room: 0.4, gain: 0.38 },
    //            bars  12345678
    // The comping drops for bar 4, so the phrase turns on the bass and the pad alone; the
    // brushes stop for the last two bars and leave the kit to play the ending by itself.
    arrangement: { perc: '11111100', chords: '11101111' },
    solos: ['piano', 'sax', 'muted-trumpet', 'clarinet', 'strumstick'],
    solo: 'piano',
  },
]

export function findStyle(id: StyleId): Style {
  return styles.find((style) => style.id === id) ?? styles[0]
}

/** The sequence id within `styleId`'s own set, falling back to its first. */
export function findSequence(styleId: StyleId, id: SequenceId): Sequence {
  const style = findStyle(styleId)
  return style.sequences.find((sequence) => sequence.id === id) ?? style.sequences[0]
}

/**
 * The selection the app opens with. It names one of the arrangements above, so it lives
 * here rather than with the vocabulary.
 */
export const defaultSelection: Selection = {
  key: 'C minor',
  style: 'night-drive',
  sequence: 'night-drive/cadence',
  chordMode: 'combo',
  arp: 'broken',
  rhythm: 'pulse',
  solo: 'rhodes',
  soloLow: DEFAULT_SOLO_RANGE.low,
  soloHigh: DEFAULT_SOLO_RANGE.high,
  tempo: 112,
}

// The catalogue checks itself as it loads. `validate.ts` says what each rule is for.
assertRhythmsDivideTheGrid(rhythms, 16)
assertPhrasesAreUniform(styles, PHRASE_BARS)
assertPhrasesDevelop(styles)
assertFilterEnvelopesHaveCutoffs(styles)
assertArrangementsAreWellFormed(styles, PHRASE_BARS)
assertStyleIsolation(styles)
