import { rhythms } from '../domain/figures'
import type { ChordId, RhythmId, SequenceId } from '../domain/vocabulary'
import type { Candidate } from '../domain/harmony'
import type { MidiSnapshot } from '../midi/midiHandler'

/**
 * What Jev is asked, and how.
 *
 * This follows the shape that suits a fast classifier: the key, the chords actually
 * played lately, and three or four candidate next chords that code has already
 * generated and validated. Jev only ranks them by vibe - it is not asked to reason
 * about voice leading or to invent anything, because the candidates it can choose
 * from are the only thing it can answer with.
 */
export type DecisionRequest = {
  style: string
  /** The style's character, so the ranking is anchored to a vibe rather than to nothing. */
  vibe: string
  key: string
  tempo: number
  /** The phrase playing now. Always one of the candidates, so "again" is always offered. */
  currentSequence: SequenceId
  /** The chords of the phrases played lately, oldest first. */
  recentChords: ChordId[]
  /** How many phrases in a row have repeated, so a long stay can be weighed against variety. */
  repeatCount: number
  /** Three or four candidate next chords, each with the phrase it would start. */
  candidates: Candidate[]
  midi: MidiSnapshot
}

/** One probability per option, summing to 1. TypeSafe returns this for every Choice. */
export type Probabilities = Record<string, number>

export type DecisionResponse = {
  /** The candidate Jev chose. Always one of the ids that were sent. */
  sequence: SequenceId
  rhythm: RhythmId
  /**
   * Each answer keeps its own confidence. Confidence describes how concentrated
   * that answer's distribution is - it is not a verdict on the workflow, so the
   * two are reported separately rather than collapsed into one number.
   */
  sequenceConfidence: number
  sequenceProbabilities: Probabilities
  rhythmConfidence: number
  rhythmProbabilities: Probabilities
  model?: string
  usage?: { input_tokens: number; output_tokens: number }
  source: 'jev' | 'fallback'
}

export async function requestDecision(request: DecisionRequest): Promise<DecisionResponse> {
  const response = await fetch('/api/decision', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`Jev request failed (${response.status})`)

  const result: unknown = await response.json()
  if (!isDecisionResponse(result, request)) throw new Error('Jev returned an invalid decision')
  return result
}

function isProbabilities(value: unknown, allowed: (key: string) => boolean): value is Probabilities {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).every(
    ([key, probability]) => allowed(key) && typeof probability === 'number',
  )
}

/**
 * Anything outside what was actually offered is rejected before it can reach the UI.
 *
 * The allowlist is the candidate set this request sent: Jev may only answer with one
 * of the chords code generated, so a wrong or inventive answer fails validation
 * instead of steering the music somewhere the style does not own.
 */
function isDecisionResponse(value: unknown, request: DecisionRequest): value is DecisionResponse {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  const offered = request.candidates.map((candidate) => candidate.id)
  const isOffered = (id: string) => offered.includes(id)
  return typeof result.sequence === 'string' && isOffered(result.sequence)
    && typeof result.rhythm === 'string' && rhythms.some((rhythm) => rhythm.id === result.rhythm)
    && typeof result.sequenceConfidence === 'number'
    && typeof result.rhythmConfidence === 'number'
    && isProbabilities(result.sequenceProbabilities, isOffered)
    && isProbabilities(result.rhythmProbabilities, (key) => rhythms.some((rhythm) => rhythm.id === key))
    && (result.source === 'jev' || result.source === 'fallback')
}

