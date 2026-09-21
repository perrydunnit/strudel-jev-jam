import { getAudioContext } from '@strudel/web'
import { noteToMidi, type Instrument } from '../domain/samples'

type Pitched = { midi: number; url: string }

export type SampleInstrument = { label: string; notes: Pitched[] }

const indexCache = new Map<string, Promise<SampleInstrument>>()
const bufferCache = new Map<string, Promise<AudioBuffer>>()

/**
 * Reads a strudel.json sample map and keeps its pitch-keyed entries, so a note
 * can be played from the nearest recorded pitch.
 */
export function loadInstrument(instrument: Instrument): Promise<SampleInstrument> {
  const key = `${instrument.mapUrl}#${instrument.sample}`
  const cached = indexCache.get(key)
  if (cached) return cached

  const pending = (async () => {
    if (!instrument.mapUrl || !instrument.sample) {
      throw new Error(`${instrument.label} is not a sampled instrument`)
    }
    const response = await fetch(instrument.mapUrl)
    if (!response.ok) throw new Error(`${response.status} loading ${instrument.mapUrl}`)
    const map = (await response.json()) as Record<string, unknown>
    const base = typeof map._base === 'string' ? map._base : ''
    const entry = map[instrument.sample]
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${instrument.sample} is not in ${instrument.mapUrl}`)
    }

    const notes: Pitched[] = []
    for (const [name, file] of Object.entries(entry as Record<string, string>)) {
      const midi = noteToMidi(name)
      if (midi !== null && typeof file === 'string') notes.push({ midi, url: `${base}${file}` })
    }
    if (!notes.length) throw new Error(`${instrument.sample} has no pitched samples`)
    notes.sort((a, b) => a.midi - b.midi)
    return { label: instrument.label, notes }
  })()

  // A failed load must not be cached, or the instrument stays broken forever.
  pending.catch(() => indexCache.delete(key))
  indexCache.set(key, pending)
  return pending
}

/** Nearest recorded pitch plus the rate that reaches `midi` exactly. */
export function pickSample(instrument: SampleInstrument, midi: number): { url: string; rate: number } {
  let best = instrument.notes[0]
  for (const candidate of instrument.notes) {
    if (Math.abs(candidate.midi - midi) < Math.abs(best.midi - midi)) best = candidate
  }
  return { url: best.url, rate: 2 ** ((midi - best.midi) / 12) }
}

export function loadBuffer(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached

  const pending = (async () => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} loading sample`)
    const bytes = await response.arrayBuffer()
    return await getAudioContext().decodeAudioData(bytes)
  })()

  pending.catch(() => bufferCache.delete(url))
  bufferCache.set(url, pending)
  return pending
}

/**
 * Fetches and decodes every sample covering `low`..`high`, so playing that range
 * never waits on the network. Returns how many distinct files were prepared.
 */
export async function preloadRange(instrument: Instrument, low: number, high: number): Promise<number> {
  const index = await loadInstrument(instrument)
  const urls = new Set<string>()
  for (let midi = Math.max(0, low); midi <= Math.min(127, high); midi += 1) {
    urls.add(pickSample(index, midi).url)
  }
  await Promise.all([...urls].map((url) => loadBuffer(url).catch(() => undefined)))
  return urls.size
}
