import 'dotenv/config'
import { createServer } from 'node:http'
import { choice, TypeSafeClient } from '@typesafe-ai/sdk'
import { chords } from '../src/domain/chords'
import type { ChordId } from '../src/domain/vocabulary'
import { chordRole } from '../src/domain/harmony'

const port = Number(process.env.PORT ?? 8787)

/**
 * A fast rank ordering, not a composer.
 *
 * The candidates are generated and validated in code - they are the style's own
 * phrases, scored by how their opening chord continues the chords leading in - and the
 * client sends them with the request. Two allowlists still live here: every proposed
 * chord must exist in the shared vocabulary, and Jev may only answer with one of the
 * candidate ids it was given. Nothing else can reach the UI.
 */
const chordIds = new Set<string>(chords.map((chord) => chord.id))

/** What an opening chord implies about when its phrase fits, from its harmonic function. */
const WHEN_BY_ROLE: Record<string, string> = {
  tonic: 'The music wants to settle, or the player has just resolved something.',
  subdominant: 'The phrase should open up rather than close. Strong after the tonic.',
  dominant: 'The next phrase should arrive with a push. Strong after a subdominant.',
  colour: 'A change of colour matters more than resolution here.',
}

const rhythmOptions = {
  lilt: { what: 'Three sparse events, off the beat, the last one lifting into the next bar.', when: 'The player needs room, and the phrase should keep drifting forward rather than sit still.' },
  pulse: { what: 'Steady eighths, on the grid.', when: 'A neutral, dependable feel fits.' },
  syncopated: { what: 'Off-beat eighths with rests.', when: 'The player is playing off the beat.' },
  driving: { what: 'Straight sixteenths, busy and insistent.', when: 'The playing is energetic and forward.' },
}

type CandidateInput = {
  id: string
  chord: string
  symbol: string
  effect: string
  repeat: boolean
}

type DecisionRequest = {
  style?: string
  vibe?: string
  key?: string
  tempo?: number
  currentSequence?: string
  recentChords?: string[]
  repeatCount?: number
  candidates?: CandidateInput[]
  midi?: {
    activeNotes?: number[]
    recentNotes?: number[]
    averageVelocity?: number
    sustain?: boolean
  }
}

let client: TypeSafeClient | undefined

function getClient() {
  if (!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is not configured')
  return client ??= new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY, timeout: 1500, retry: { maxRetries: 0 } })
}

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function readBody(request: import('node:http').IncomingMessage): Promise<DecisionRequest> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > 100_000) reject(new Error('Request body is too large'))
    })
    request.on('end', () => {
      try { resolve(JSON.parse(body) as DecisionRequest) } catch { reject(new Error('Request body must be valid JSON')) }
    })
    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { sendJson(response, 204, {}); return }
  if (request.method !== 'POST' || request.url !== '/api/decision') { sendJson(response, 404, { error: 'Not found' }); return }

  try {
    const input = await readBody(request)
    // Allowlist one: only chords from the shared vocabulary can be proposed.
    const candidates = (input.candidates ?? []).filter(
      (candidate) => chordIds.has(candidate.chord),
    )
    if (!candidates.length) {
      sendJson(response, 400, { error: 'No valid candidate chords were offered' })
      return
    }

    // Option values are the candidate ids, so the answer can only name something the
    // client actually offered. The descriptions are built here from each chord's
    // function, so the model sees what every next chord would do.
    const nextOptions = Object.fromEntries(
      candidates.map((candidate) => [
        candidate.id,
        {
          what: `Opens on ${candidate.symbol}. ${candidate.effect}`,
          when: candidate.repeat
            ? 'The exception, not the default: only when the phrase is still building or the player is clearly settled inside it.'
            : WHEN_BY_ROLE[chordRole(candidate.chord as ChordId)],
        },
      ]),
    )

    const result = await getClient().systemOne({
      state: {
        style: input.style ?? 'Night drive',
        character: input.vibe ?? 'unhurried, late-night',
        key: input.key ?? 'C minor',
        tempo: input.tempo ?? 112,
        playingNow: input.currentSequence ?? 'unknown',
        chordsLeadingIn: input.recentChords ?? [],
        timesRepeated: input.repeatCount ?? 0,
        midi: input.midi ?? {},
      },
      questions: {
        // Instructions carry the whole question; nested state is referenced by path.
        next: choice(
          {
            question: 'The phrase playing now is one bar from its end. Which next chord should follow it?',
            focus: 'The key is `key`. The chords leading into this decision are `chordsLeadingIn`, oldest first, and each option opens on the chord it would start. Judge which move fits the moment in `style`, whose character is `character`. After `timesRepeated` phrases in a row, a change is the default answer and repeating is the exception, unless the player is clearly settled inside the phrase - a jam partner that loops one phrase is not steering.',
            note: 'Every option is a phrase this style already owns, so all of them are musically valid. This is a taste decision about the vibe, not a correctness one.',
          },
          nextOptions,
        ),
        rhythm: choice(
          {
            question: 'Which rhythmic feel should the arrangement play for the next phrase?',
            focus: 'Match the feel to how busy the player is, judging by `midi.recentNotes` and `midi.averageVelocity`. Only the chosen feel is used.',
          },
          rhythmOptions,
        ),
      },
    })

    const next = result.answers.next
    const rhythm = result.answers.rhythm
    // Docs: to debug a decision, inspect the exact state, answers and distribution.
    console.log(
      `[jev] ${input.currentSequence} +[${(input.recentChords ?? []).join(' ')}] -> ${next.choice} (${next.confidence.toFixed(2)})`
      + ` | rhythm ${rhythm.choice} (${rhythm.confidence.toFixed(2)})`
      + ` | offered=${candidates.length} played=${input.midi?.activeNotes?.length ?? 0} repeats=${input.repeatCount ?? 0}`
      + ` | tokens=${result.usage.input_tokens}/${result.usage.output_tokens} model=${result.model}`,
    )

    // Both answers are returned whole: each has its own confidence, and the
    // probabilities stay available so the UI need not re-run inference to show them.
    sendJson(response, 200, {
      sequence: next.choice,
      rhythm: rhythm.choice,
      sequenceConfidence: next.confidence,
      sequenceProbabilities: next.probabilities,
      rhythmConfidence: rhythm.confidence,
      rhythmProbabilities: rhythm.probabilities,
      model: result.model,
      usage: result.usage,
      source: 'jev',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jev request failed'
    sendJson(response, message.includes('TYPESAFE_API_KEY') ? 503 : 502, { error: message })
  }
})

server.listen(port, () => console.log(`Jev proxy listening on http://localhost:${port}`))
