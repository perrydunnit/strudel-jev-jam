import { chordRole, chordSymbol, findChord, openingChord } from './chords'
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
 * The functional model is the three functions of tonal harmony (mc-harmony): tonic,
 * subdominant and dominant, with the modal chords as colour. A dominant wants the tonic,
 * a subdominant wants the dominant, a tonic wants to leave home. The table itself lives in
 * `chords.ts` so that `validate.ts` can check a phrase's seam against it without importing
 * this module, which would be a cycle.
 */

/** How well `next` follows `last`. Higher is a more expected continuation. */
function fit(last: ChordId | undefined, next: ChordId): number {
  if (!last) return 0
  const from = chordRole(last)
  const to = chordRole(next)
  if (from === 'dominant') return to === 'tonic' ? 3 : to === 'colour' ? 1 : 0
  if (from === 'subdominant') return to === 'dominant' ? 3 : to === 'tonic' ? 1 : 0
  if (from === 'tonic') return to === 'subdominant' ? 3 : to === 'colour' ? 2 : to === 'dominant' ? 1 : 0
  return to === 'tonic' ? 2 : to === 'dominant' ? 2 : 1
}

/** The harmonic function a chord serves. Re-exported so the proxy can describe a move. */
export { chordRole }

/**
 * How many times the form plays before the next one is led from a different section.
 *
 * The form is what the player commits to, so the *schedule* is what makes the music predictable:
 * this many plays, then a new lead. Deciding that a move happens is not a judgement call, and
 * treating it as one is how this app ended up frozen - asked whether to move, Jev answered 1.00
 * for staying, every single time, so the harmony call fired once a form and never did anything.
 *
 * What *is* a judgement call is where the form is led from next, and that is the question Jev is
 * asked: staying is dropped from the options at the point a move is due, so the answer is always
 * a real destination.
 *
 * The destination is a rotation of the same cycle, so every form is the same sections in the same
 * relative order. The band always knows the material; all that moves is which section leads.
 */
export const HOLD_FORMS = 2

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
 * opening chord continues the chords just played. No two candidates open on the same chord,
 * because no style has two sequences that do.
 *
 * The phrase that just finished is among them, so "keep going" is a real option here. It is the
 * *caller* that drops it, and only at the point a move is due - choosing when the form moves is a
 * schedule, and choosing where it moves is the taste decision this function exists to serve.
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
    // No bonus for staying put: a phrase that loops well resolves into its own opening, so its
    // opening chord already fits better than most and it is returned first regardless. Scoring it
    // as well would be double counting. When the form moves is `HOLD_FORMS`' business, not this
    // ranking's, and at the point it moves the stay candidate is dropped before the question is
    // even asked.
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
