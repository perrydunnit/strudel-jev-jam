export type KeyId = 'C minor' | 'D minor' | 'F major' | 'A minor'
export type HarmonyId = 'i' | 'iv' | 'v' | 'VI' | 'VII'
export type ArpId = 'block' | 'up' | 'down' | 'broken' | 'pedal'
export type RhythmId = 'drift' | 'pulse' | 'syncopated' | 'driving'
export type PaletteId = 'glass' | 'warm' | 'plucked' | 'hollow'

export type Selection = {
  key: KeyId
  harmony: HarmonyId
  arp: ArpId
  rhythm: RhythmId
  palette: PaletteId
  tempo: number
}

export type Layer = { name: string; detail: string; notes: string }
export type PatternPlan = {
  code: string
  chordLabel: string
  layers: Layer[]
}

export type Voice = {
  sound: string
  /** Required for `s("user")` - superdough warns and falls back to triangle without it. */
  partials?: number[]
  lpf: number
  lpq?: number
  attack: number
  release: number
  room: number
  gain: number
  delay?: number
  distort?: number
}

type Palette = { id: PaletteId; label: string; description: string; pad: Voice; motion: Voice; bass: Voice; keys: Voice }
type Harmony = { id: HarmonyId; label: string; description: string; color: string; quality: string; offsets: number[]; root: number }
type Arp = { id: ArpId; label: string; description: string }
type Rhythm = { id: RhythmId; label: string; description: string; slots: number; rests: number[] }

/**
 * Spelling tables are indexed by absolute pitch class, so transposed chords keep
 * correct accidentals (C minor needs B natural for the V chord, A minor needs G#/C#).
 */
const KEYS: Record<KeyId, { tonicPc: number; spelling: string[] }> = {
  'C minor': { tonicPc: 0, spelling: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] },
  'D minor': { tonicPc: 2, spelling: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] },
  'F major': { tonicPc: 5, spelling: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] },
  'A minor': { tonicPc: 9, spelling: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'] },
}

export const keys = Object.keys(KEYS) as KeyId[]

export const harmonies: Harmony[] = [
  { id: 'i', label: 'Home', description: 'root minor · settled', color: '#c8d86c', quality: 'm', offsets: [0, 3, 7], root: 0 },
  { id: 'iv', label: 'Open the room', description: 'subdominant · lifting', color: '#e6b85c', quality: 'm', offsets: [5, 8, 12], root: 5 },
  { id: 'v', label: 'Lean forward', description: 'dominant major · tension', color: '#ef795f', quality: '', offsets: [7, 11, 14], root: 7 },
  { id: 'VI', label: 'Turn inward', description: 'submediant major · duskier', color: '#b875d1', quality: '', offsets: [8, 12, 15], root: 8 },
  { id: 'VII', label: 'Break the grid', description: 'subtonic major · bright', color: '#55b7aa', quality: '', offsets: [10, 14, 17], root: 10 },
]

export const arps: Arp[] = [
  { id: 'block', label: 'Block', description: 'whole chord struck together' },
  { id: 'up', label: 'Rising', description: 'low to high arpeggio' },
  { id: 'down', label: 'Falling', description: 'high to low arpeggio' },
  { id: 'broken', label: 'Broken', description: 'leaping figure' },
  { id: 'pedal', label: 'Pedal', description: 'root held under movement' },
]

export const rhythms: Rhythm[] = [
  { id: 'drift', label: 'Drift', description: 'sparse, weightless', slots: 3, rests: [] },
  { id: 'pulse', label: 'Pulse', description: 'steady eighth motion', slots: 6, rests: [] },
  { id: 'syncopated', label: 'Syncopated', description: 'off-beat push', slots: 8, rests: [1, 4, 6] },
  { id: 'driving', label: 'Driving', description: 'busy sixteenths', slots: 12, rests: [] },
]

export const palettes: Palette[] = [
  {
    id: 'glass',
    label: 'Glass',
    description: 'sine partials, long room',
    pad: { sound: 'sawtooth', lpf: 1200, lpq: 2, attack: 0.5, release: 1.4, room: 0.5, gain: 0.16 },
    motion: { sound: 'user', partials: [1, 0.32, 0.13, 0.05, 0.02], lpf: 2600, attack: 0.004, release: 0.34, room: 0.45, gain: 0.3, delay: 0.28 },
    bass: { sound: 'sine', lpf: 260, attack: 0.02, release: 0.9, room: 0.25, gain: 0.5 },
    keys: { sound: 'user', partials: [1, 0.45, 0.2, 0.09, 0.04], lpf: 3200, attack: 0.004, release: 0.9, room: 0.5, gain: 0.32, delay: 0.25 },
  },
  {
    id: 'warm',
    label: 'Warm tape',
    description: 'soft filtered pad, round lead',
    pad: { sound: 'sawtooth', lpf: 760, lpq: 1.5, attack: 0.8, release: 1.8, room: 0.6, gain: 0.18 },
    motion: { sound: 'triangle', lpf: 1900, attack: 0.01, release: 0.5, room: 0.5, gain: 0.28, delay: 0.2 },
    bass: { sound: 'sine', lpf: 220, attack: 0.02, release: 1.2, room: 0.25, gain: 0.55 },
    keys: { sound: 'triangle', lpf: 2000, attack: 0.012, release: 1.1, room: 0.5, gain: 0.34 },
  },
  {
    id: 'plucked',
    label: 'Plucked',
    description: 'short plucks with bite',
    pad: { sound: 'square', lpf: 620, lpq: 4, attack: 0.6, release: 1.2, room: 0.35, gain: 0.12 },
    motion: { sound: 'square', lpf: 2100, attack: 0.002, release: 0.16, room: 0.3, gain: 0.24, delay: 0.22, distort: 0.18 },
    bass: { sound: 'triangle', lpf: 240, attack: 0.01, release: 0.5, room: 0.2, gain: 0.5 },
    keys: { sound: 'square', lpf: 2400, attack: 0.002, release: 0.25, room: 0.3, gain: 0.3 },
  },
  {
    id: 'hollow',
    label: 'Hollow',
    description: 'airy, wide and distant',
    pad: { sound: 'user', partials: [1, 0.12, 0.05], lpf: 900, lpq: 1, attack: 1.2, release: 2.4, room: 0.75, gain: 0.2 },
    motion: { sound: 'sine', lpf: 1500, attack: 0.02, release: 0.8, room: 0.65, gain: 0.3, delay: 0.35 },
    bass: { sound: 'triangle', lpf: 200, attack: 0.03, release: 1.4, room: 0.3, gain: 0.45 },
    keys: { sound: 'sine', lpf: 1600, attack: 0.02, release: 1.4, room: 0.7, gain: 0.34, delay: 0.3 },
  },
]

export const STYLE_PALETTES: Record<string, PaletteId> = {
  'Night drive': 'glass',
  'Broken beat': 'plucked',
  'Slow bloom': 'hollow',
  'After-hours jazz': 'warm',
}

export const defaultSelection: Selection = {
  key: 'C minor',
  harmony: 'i',
  arp: 'broken',
  rhythm: 'pulse',
  palette: 'glass',
  tempo: 112,
}

export function findHarmony(id: string): Harmony {
  return harmonies.find((harmony) => harmony.id === id) ?? harmonies[0]
}

export function findRhythm(id: string): Rhythm {
  return rhythms.find((rhythm) => rhythm.id === id) ?? rhythms[1]
}

export function findArp(id: ArpId): Arp {
  return arps.find((arp) => arp.id === id) ?? arps[0]
}

export function findPalette(id: PaletteId): Palette {
  return palettes.find((palette) => palette.id === id) ?? palettes[0]
}

/** Absolute pitch class + octave, spelled for the selected key. */
function pitch(offset: number, key: KeyId, octave: number): string {
  const { tonicPc, spelling } = KEYS[key]
  const total = tonicPc + offset
  return `${spelling[((total % 12) + 12) % 12].toLowerCase()}${octave + Math.floor(total / 12)}`
}

function chordNotes(harmony: Harmony, key: KeyId): string[] {
  return harmony.offsets.map((offset) => pitch(offset, key, 3))
}

function chordLabel(harmony: Harmony, key: KeyId): string {
  const root = pitch(harmony.root, key, 3)
  return `${root[0].toUpperCase()}${root.slice(1, -1)}${harmony.quality}`
}

function arpTokens(chord: string[], arp: ArpId): string[] {
  const [low, mid, high] = chord
  switch (arp) {
    case 'block': return [`[${chord.join(',')}]`]
    case 'up': return [low, mid, high]
    case 'down': return [high, mid, low]
    case 'broken': return [low, high, mid, high]
    case 'pedal': return [`[${low},${mid}]`, `[${low},${high}]`]
  }
}

function voiceCode(voice: Voice, includeGain = true): string {
  const parts = [`s("${voice.sound}")`]
  if (voice.partials) parts.push(`partials([${voice.partials.join(',')}])`)
  parts.push(`lpf(${voice.lpf})`)
  if (voice.lpq) parts.push(`lpq(${voice.lpq})`)
  parts.push(`attack(${voice.attack})`, `release(${voice.release})`, `room(${voice.room})`)
  if (voice.delay) parts.push(`delay(${voice.delay})`, `delaytime(0.28)`, `delayfeedback(0.35)`)
  if (voice.distort) parts.push(`distort(${voice.distort})`)
  if (includeGain) parts.push(`gain(${voice.gain})`)
  return parts.join('.')
}

/**
 * Builds the Strudel program for a selection.
 *
 * Every fragment comes from the tables above - notes, sounds, filters and the
 * decision ids themselves are allowlisted, so no model output ever reaches
 * `evaluate()` as executable source.
 */
export function buildPattern(selection: Selection): PatternPlan {
  const harmony = findHarmony(selection.harmony)
  const arp = findArp(selection.arp)
  const rhythm = findRhythm(selection.rhythm)
  const palette = findPalette(selection.palette)

  const chord = chordNotes(harmony, selection.key)
  const root = pitch(harmony.root, selection.key, 2)
  const tokens = arpTokens(chord, selection.arp)

  // `~` marks a rest; gains mirror the rests so no event fires without a gain.
  const steps = Array.from({ length: rhythm.slots }, (_, index) =>
    rhythm.rests.includes(index) ? '~' : tokens[index % tokens.length])
  const gains = Array.from({ length: rhythm.slots }, (_, index) =>
    rhythm.rests.includes(index) ? '~' : (index % 4 === 0 ? 0.85 : 0.5) * palette.motion.gain)

  const pad = `note("[${chord.join(',')}]").${voiceCode(palette.pad)}.slow(2)`
  const bass = `note("${root}").${voiceCode(palette.bass)}.slow(2)`
  const motion = `note("${steps.join(' ')}").${voiceCode(palette.motion, false)}.gain("${gains.map((gain) => typeof gain === 'number' ? gain.toFixed(3) : gain).join(' ')}")`

  return {
    code: `stack(${pad}, ${bass}, ${motion}).cps(${(selection.tempo / 240).toFixed(6)})`,
    chordLabel: chordLabel(harmony, selection.key),
    layers: [
      { name: 'Pad', detail: `${harmony.label} · ${palette.pad.sound} · 2 bars`, notes: chord.join(' ') },
      { name: 'Bass', detail: `root · ${palette.bass.sound} · 2 bars`, notes: root },
      { name: 'Motion', detail: `${arp.label} · ${rhythm.label} · ${palette.motion.sound}`, notes: steps.join(' ') },
    ],
  }
}

