import { chordSymbol, findChord, openingChord } from './chords'
import { findStyle } from './styles'
import type { ChordId, KeyId, SequenceId, StyleId } from './vocabulary'

/**
 * Rule-based next-chord candidates.
 *
 * This is the "generate and validate with code" half of the workflow. The candidates
 * come from music theory, not from the model: only chords that actually continue the
 * phrase well are offered, and each one is offered as the opening of one of the
 * style's own sequences, so choosing it also decides what gets played. Jev only ranks
 * them by vibe - it never invents a chord, and it cannot reach music the style does
 * not own.
 *
 * The functional model is the three functions of tonal harmony (mc-harmony):
 * tonic, subdominant and dominant, with the modal chords as colour. A dominant wants
 * the tonic, a subdominant wants the dominant, a tonic wants to leave home.
 */

type Role = 'tonic' | 'subdominant' | 'dominant' | 'colour'

const ROLES: Record<ChordId, Role> = {
  i: 'tonic',
  i7: 'tonic',
  imaj7: 'tonic',
  // The cadential 64 is dominant in function: it is a suspension over the dominant's bass.
  i64: 'dominant',
  III: 'colour',
  iv: 'subdominant',
  iv7: 'subdominant',
  IV: 'subdominant',
  'iiø7': 'subdominant',
  V: 'dominant',
  V7: 'dominant',
  V7sus4: 'dominant',
  'V7/iv': 'dominant',
  VI: 'colour',
  VII: 'colour',
  VII7: 'dominant',
  bII: 'colour',
}

/** How well `next` follows `last`. Higher is a more expected continuation. */
function fit(last: ChordId | undefined, next: ChordId): number {
  if (!last) return 0
  const from = ROLES[last]
  const to = ROLES[next]
  if (from === 'dominant') return to === 'tonic' ? 3 : to === 'colour' ? 1 : 0
  if (from === 'subdominant') return to === 'dominant' ? 3 : to === 'tonic' ? 1 : 0
  if (from === 'tonic') return to === 'subdominant' ? 3 : to === 'colour' ? 2 : to === 'dominant' ? 1 : 0
  return to === 'tonic' ? 2 : to === 'dominant' ? 2 : 1
}

/** The harmonic function a chord serves. Exported so the proxy can describe a move. */
export function chordRole(id: ChordId): Role {
  return ROLES[id] ?? 'colour'
}

export type Candidate = {
  /** The sequence this candidate would play. */
  id: SequenceId
  /** The chord the phrase would open on - the actual "next chord". */
  chord: ChordId
  /** That chord as a symbol in the current key, e.g. `G7`. */
  symbol: string
  label: string
  /** What the phrase does, phrased for a taste decision rather than a technical one. */
  effect: string
  /** True for the phrase that just finished, so staying put stays a real option. */
  repeat: boolean
}

/**
 * Three or four next chords for Jev to rank, each with the phrase it would start.
 *
 * Candidates are drawn from the style's own sequences, scored by how well their
 * opening chord continues the chords just played. The phrase that just finished is
 * always among them, so "keep going" is never silently removed from the choice, and
 * no two candidates open on the same chord because no style has two sequences that do.
 */
export function nextChordCandidates(
  styleId: StyleId,
  current: SequenceId,
  recent: ChordId[],
  key: KeyId,
  limit = 4,
): Candidate[] {
  const style = findStyle(styleId)
  const last = recent[recent.length - 1]

  const scored = style.sequences.map((sequence) => {
    const opening = openingChord(sequence)
    const repeat = sequence.id === current
    // Deliberately no bonus for staying put. A phrase that loops well resolves into its
    // own opening, so its opening chord already fits better than most - adding to that
    // would make "again" the top candidate by rule and quietly turn Jev's choice into a
    // formality.
    return { sequence, opening, repeat, score: fit(last, opening) }
  })

  scored.sort((left, right) => right.score - left.score || left.sequence.id.localeCompare(right.sequence.id))
  const chosen = scored.slice(0, Math.max(1, limit))

  // Staying put must survive the cut: it is the safest continuation, and dropping it
  // would quietly remove the only option that keeps the phrase the player is in.
  const here = scored.find((entry) => entry.repeat)
  if (here && !chosen.includes(here)) chosen[chosen.length - 1] = here

  return chosen
    .map((entry) => {
      const chord = findChord(entry.opening)
      return {
        id: entry.sequence.id,
        chord: entry.opening,
        symbol: chordSymbol(chord, key),
        label: entry.sequence.label,
        effect: entry.repeat ? `Play again: ${entry.sequence.effect}` : entry.sequence.effect,
        repeat: entry.repeat,
      }
    })
    .sort((left, right) => Number(right.repeat) - Number(left.repeat))
}

/** The chords actually played by a sequence, in order, for Jev's recent-chord context. */
export function sequenceChords(bars: (ChordId | [ChordId, ChordId])[]): ChordId[] {
  return bars.flat()
}
