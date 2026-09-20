import 'dotenv/config'
import { createServer } from 'node:http'
import { choice, TypeSafeClient } from '@typesafe-ai/sdk'

const port = Number(process.env.PORT ?? 8787)

// Keys must match the allowlists in src/domain/music.ts exactly.
const harmonyOptions = {
  i: 'Return home to the root minor chord.',
  iv: 'Move to the subdominant for a stable lift.',
  v: 'Move to the dominant major chord for tension.',
  VI: 'Move to the submediant major for a duskier colour.',
  VII: 'Move to the subtonic major for a bright surprise.',
} as const

const rhythmOptions = {
  drift: 'Sparse and weightless, barely moving.',
  pulse: 'Steady, evenly spaced motion.',
  syncopated: 'Off-beat push with rests.',
  driving: 'Busy, insistent sixteenth motion.',
} as const

type DecisionRequest = {
  style?: string
  key?: string
  tempo?: number
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
    const result = await getClient().systemOne({
      state: {
        style: input.style ?? 'Night drive',
        key: input.key ?? 'C minor',
        tempo: input.tempo ?? 112,
        midi: input.midi ?? {},
      },
      questions: {
        harmony: choice('Choose the next harmonic direction for this jam.', harmonyOptions),
        rhythm: choice('Choose the rhythmic feel for the next section.', rhythmOptions),
      },
    })
    sendJson(response, 200, {
      harmony: result.answers.harmony.choice,
      rhythm: result.answers.rhythm.choice,
      // The weaker of the two answers, so a confident rhythm cannot mask an unsure harmony.
      confidence: Math.min(result.answers.harmony.confidence, result.answers.rhythm.confidence),
      source: 'jev',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jev request failed'
    sendJson(response, message.includes('TYPESAFE_API_KEY') ? 503 : 502, { error: message })
  }
})

server.listen(port, () => console.log(`Jev proxy listening on http://localhost:${port}`))
