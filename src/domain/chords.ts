/**
 * The chord vocabulary and how it is spelled.
 *
 * Chords are written as semitone `offsets` above the tonic rather than as absolute notes,
 * so a sequence transposes by changing the key alone and nothing else has to know what key
 * it is in. Roman numerals are the function; the voicing is only a voicing.
 */
import type { ChordId, KeyId, Sequence } from './vocabulary'

/** One chord. `bass` is set only when the lowest voice is not the root. */
export type Chord = {
  id: ChordId
  label: string
  description: string
  color: string
  /** Suffix used in the chord symbol: `m`, `7`, `maj7`, `7sus4`, ... */
  quality: string
  offsets: number[]
  root: number
  bass?: number
}

/**
 * Spelling tables are indexed by absolute pitch class, so every key spells its own
 * chromatic notes correctly: C minor needs B natural for the dominant, A minor needs
 * G sharp, D minor needs C sharp, F minor needs E natural.
 */
const KEYS: Record<KeyId, { tonicPc: number; spelling: string[] }> = {
  'C minor': { tonicPc: 0, spelling: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] },
  'D minor': { tonicPc: 2, spelling: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] },
  'F minor': { tonicPc: 5, spelling: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] },
  'A minor': { tonicPc: 9, spelling: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'] },
}

export const keys = Object.keys(KEYS) as KeyId[]

/**
 * The chord vocabulary, in minor. `V` and `V7` come from the harmonic minor, so the
 * dominant actually pulls home instead of drifting.
 */
export const chords: Chord[] = [
  { id: 'i', label: 'Home', description: 'tonic minor · settled', color: '#c8d86c', quality: 'm', offsets: [0, 3, 7], root: 0 },
  { id: 'i7', label: 'Home, softened', description: 'tonic minor 7 · warm, still open, bass a whole step down', color: '#c2d472', quality: 'm7', offsets: [0, 3, 7, 10], root: 0, bass: 10 },
  { id: 'imaj7', label: 'Aching', description: 'minor major 7 · the leading tone inside the tonic, bass a half step down', color: '#a8c96b', quality: 'm(maj7)', offsets: [0, 3, 7, 11], root: 0, bass: 11 },
  { id: 'i64', label: 'Suspended home', description: 'tonic over the dominant bass · the cadential 64', color: '#b7cf74', quality: 'm', offsets: [0, 3, 7], root: 0, bass: 7 },
  { id: 'III', label: 'Open sky', description: 'relative major · the key brightens', color: '#7fd0a0', quality: '', offsets: [3, 7, 10], root: 3 },
  { id: 'iv', label: 'Open the room', description: 'subdominant minor · lifting', color: '#e6b85c', quality: 'm', offsets: [5, 8, 12], root: 5 },
  { id: 'iv7', label: 'Softening', description: 'subdominant minor 7 · doubles as the relative major\u2019s ii', color: '#dfae52', quality: 'm7', offsets: [5, 8, 12, 15], root: 5 },
  { id: 'IV', label: 'Brightening', description: 'subdominant major · borrowed from the parallel major', color: '#f0c664', quality: '', offsets: [5, 9, 12], root: 5 },
  { id: 'ii\u00f87', label: 'Unsure', description: 'half-diminished second · the two of a minor two-five', color: '#c9a0e0', quality: '\u00f87', offsets: [2, 5, 8, 12], root: 2 },
  { id: 'V', label: 'Lean forward', description: 'dominant major · raised seventh, wants home', color: '#ef795f', quality: '', offsets: [7, 11, 14], root: 7 },
  { id: 'V7', label: 'Lean hard', description: 'dominant 7th · the strongest pull back to the tonic', color: '#e5644a', quality: '7', offsets: [7, 11, 14, 17], root: 7 },
  { id: 'V7sus4', label: 'Hover', description: 'dominant 7 suspended · no third, so it never quite resolves', color: '#d98a6a', quality: '7sus4', offsets: [7, 12, 14, 17], root: 7 },
  { id: 'V7/iv', label: 'Turn to iv', description: 'dominant of iv · the tonic repurposed to point at the subdominant', color: '#e08b3f', quality: '7', offsets: [0, 4, 7, 10], root: 0 },
  { id: 'VI', label: 'Turn inward', description: 'submediant major · duskier', color: '#b875d1', quality: '', offsets: [8, 12, 15], root: 8 },
  { id: 'VII', label: 'Break the grid', description: 'subtonic major · modal, no leading tone', color: '#55b7aa', quality: '', offsets: [10, 14, 17], root: 10 },
  { id: 'VII7', label: 'Clearing', description: 'subtonic 7th · the relative major\u2019s dominant', color: '#4aa89c', quality: '7', offsets: [10, 14, 17, 20], root: 10 },
  // First inversion, which is what makes this a Neapolitan rather than a chord that merely
  // sits above the tonic: the bass holds the subdominant's note while the flat sixth above it
  // falls a semitone to the dominant. In root position the bass leaps instead, and the
  // move loses the voice leading that is the whole reason to use the chord.
  { id: 'bII', label: 'Drop', description: 'Neapolitan · first inversion, so its bass holds while the sixth falls to the dominant', color: '#8f7fd8', quality: '', offsets: [1, 5, 8], root: 1, bass: 5 },
]

export function findChord(id: string): Chord {
  return chords.find((chord) => chord.id === id) ?? chords[0]
}

/** The chord a sequence opens on. A bar holds one chord, or two moving between them. */
export function openingChord(sequence: Sequence): ChordId {
  const [bar] = sequence.bars
  return typeof bar === 'string' ? bar : bar[0]
}

/** The chord a sequence closes on - the other end of the seam when the phrase repeats. */
export function closingChord(sequence: Sequence): ChordId {
  const bar = sequence.bars[sequence.bars.length - 1]
  return typeof bar === 'string' ? bar : bar[bar.length - 1]
}

/**
 * The harmonic function a chord serves.
 *
 * This lives here rather than in `harmony.ts`, where it is used, because `validate.ts` needs
 * it too and `validate.ts` must not import anything that imports the style tables - the whole
 * point of that module is that the tables are arguments to it, so it can never take part in
 * an import cycle. `chords.ts` is a leaf, so both can depend on it.
 */
export type ChordRole = 'tonic' | 'subdominant' | 'dominant' | 'colour'
export const CHORD_ROLES: Record<ChordId, ChordRole> = {
  i: 'tonic',
  i7: 'tonic',
  imaj7: 'tonic',
  // The cadential 64 is dominant in function: it is a suspension over the dominant's bass.
  i64: 'dominant',
  III: 'colour',
  iv: 'subdominant',
  iv7: 'subdominant',
  IV: 'subdominant',
  'ii\u00f87': 'subdominant',
  V: 'dominant',
  V7: 'dominant',
  V7sus4: 'dominant',
  'V7/iv': 'dominant',
  VI: 'colour',
  VII: 'colour',
  VII7: 'dominant',
  bII: 'colour',
}

export function chordRole(id: ChordId): ChordRole {
  return CHORD_ROLES[id] ?? 'colour'
}

/** The opening chord of a sequence, e.g. for colour-coding it in the UI. */
export function firstChord(sequence: Sequence): Chord {
  return findChord(openingChord(sequence))
}

/** Absolute pitch class + octave, spelled for the selected key. */
export function pitch(offset: number, key: KeyId, octave: number): string {
  const { tonicPc, spelling } = KEYS[key]
  const total = tonicPc + offset
  return `${spelling[((total % 12) + 12) % 12].toLowerCase()}${octave + Math.floor(total / 12)}`
}

/** The chord's notes as written pitches, one per offset. */
export function chordNotes(chord: Chord, key: KeyId): string[] {
  return chord.offsets.map((offset) => pitch(offset, key, 3))
}

/**
 * The pad's voicing as semitone offsets from the tonic, ascending: the chord opened out.
 *
 * Every chord in the table is written in closed root position - a triad inside a fifth, a seventh
 * chord inside a seventh - and they are all pitched in the same octave, so every change moved by a
 * step or two in the middle of the texture and nothing else happened. Raising the second voice from
 * the bottom by an octave is the standard open voicing: the root stays where it was, the fifth sits
 * above it, and the third goes on top an octave higher. The same notes now span a twelfth or more,
 * which is where a pad's width comes from, and it puts the third in the clearest place to be heard -
 * a closed triad hides the note that says whether the chord is major or minor.
 *
 * Two things follow from this being a separate function rather than a rewrite of `offsets`. The
 * figure arpeggiates chord tones in the order they are written and the bass reads offset 1 and 2 as
 * the third and the fifth, so the written order has to stay exactly as it is; and the voicing is a
 * property of the pad, not of the chord - a chord is an idea, and this is one way of laying it out.
 */
export function padOffsets(chord: Chord): number[] {
  const raised = [...chord.offsets]
  if (raised.length > 2) raised[1] += 12
  return raised.sort((a, b) => a - b)
}

/** The pad's voicing as written pitches: `padOffsets`, in octave 3. */
export function padVoicing(chord: Chord, key: KeyId): string[] {
  return padOffsets(chord).map((offset) => pitch(offset, key, 3))
}

/** Chord symbol: root, quality, and the bass note when the chord is inverted. */
export function chordSymbol(chord: Chord, key: KeyId): string {
  const name = (offset: number) => {
    const note = pitch(offset, key, 3)
    return `${note[0].toUpperCase()}${note.slice(1, -1)}`
  }
  const slash = chord.bass === undefined || chord.bass === chord.root ? '' : `/${name(chord.bass)}`
  return `${name(chord.root)}${chord.quality}${slash}`
}
