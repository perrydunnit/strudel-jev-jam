/**
 * The vocabulary of a chord figure: how its notes are ordered (the arpeggio) and when it
 * plays them (the rhythm).
 *
 * The two are deliberately separate, because they answer different questions and the app
 * lets you set them independently. `arpTokens` turns a chord's notes into the tokens a
 * figure plays, and `rests` says which of its slots are silent.
 */
import type { ArpId, RhythmId } from './vocabulary'

export type Arp = { id: ArpId; label: string; description: string }

/**
 * One rhythm of the figure.
 *
 * `slots` is how many events fill a bar, and the whole arrangement is on a straight
 * sixteenth grid, so slots must divide 16: 4 (quarters), 8 (eighths) or 16
 * (sixteenths). Slots of 3, 6 or 12 put the figure on a triplet grid instead, which is
 * a 3:2 polyrhythm against straight drums - see `validate.ts`.
 *
 * `rests` are positions within the bar, so they survive a chord change mid-bar.
 *
 * A rest is not only a rhythmic choice. The figure plays `tokens[slot % tokens.length]`
 * and the first token is the chord's lowest note, so an empty slot also changes which
 * chord tone the remaining slots land on. A rhythm sounding slots 0 and 4 therefore puts
 * the bass note in every event: it was 68% of them, which read as a doubled bass line and
 * made the chord layer disappear. `lilt` sounds slots 1, 2 and 7 instead.
 */
export type Rhythm = { id: RhythmId; label: string; description: string; slots: number; rests: number[] }

export const arps: Arp[] = [
  { id: 'block', label: 'Block', description: 'whole chord struck together' },
  { id: 'up', label: 'Rising', description: 'low to high arpeggio' },
  { id: 'down', label: 'Falling', description: 'high to low arpeggio' },
  { id: 'broken', label: 'Broken', description: 'leaping figure' },
  { id: 'pedal', label: 'Pedal', description: 'root held under movement' },
]

export const rhythms: Rhythm[] = [
  { id: 'lilt', label: 'Lilt', description: 'upper tones, then a lift into the next bar', slots: 8, rests: [0, 3, 4, 5, 6] },
  { id: 'pulse', label: 'Pulse', description: 'steady eighth motion', slots: 8, rests: [] },
  { id: 'syncopated', label: 'Syncopated', description: 'off-beat push', slots: 8, rests: [1, 4, 6] },
  { id: 'driving', label: 'Driving', description: 'straight sixteenths', slots: 16, rests: [] },
]

export function findArp(id: ArpId): Arp {
  return arps.find((arp) => arp.id === id) ?? arps[0]
}

export function findRhythm(id: string): Rhythm {
  return rhythms.find((rhythm) => rhythm.id === id) ?? rhythms[1]
}

/**
 * The figure a chord plays, as mini-notation tokens. Written for any number of chord
 * tones, because the vocabulary uses seventh chords as well as triads.
 */
export function arpTokens(chord: string[], arp: ArpId): string[] {
  const low = chord[0]
  const high = chord[chord.length - 1]
  const middle = chord.slice(1, -1)
  switch (arp) {
    case 'block': return [`[${chord.join(',')}]`]
    case 'up': return [...chord]
    case 'down': return [...chord].reverse()
    case 'broken': return [low, high, ...(middle.length ? middle : [low]), high]
    case 'pedal': return [low, ...middle.map((note) => `[${low},${note}]`), `[${low},${high}]`]
  }
}
