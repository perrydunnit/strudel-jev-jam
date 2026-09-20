import { harmonies, rhythms, type HarmonyId, type RhythmId } from '../domain/music'
import type { MidiSnapshot } from '../midi/midiHandler'

export type DecisionRequest = {
  style: string
  key: string
  tempo: number
  midi: MidiSnapshot
}

export type DecisionResponse = {
  harmony: HarmonyId
  rhythm: RhythmId
  confidence: number
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
  if (!isDecisionResponse(result)) throw new Error('Jev returned an invalid decision')
  return result
}

/** Anything outside the local allowlists is rejected before it can reach the UI. */
function isDecisionResponse(value: unknown): value is DecisionResponse {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return harmonies.some((harmony) => harmony.id === result.harmony)
    && rhythms.some((rhythm) => rhythm.id === result.rhythm)
    && typeof result.confidence === 'number'
    && (result.source === 'jev' || result.source === 'fallback')
}

