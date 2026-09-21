/**
 * Sample maps that the strudel.cc REPL loads by default. They are hosted on a
 * CORS-enabled CDN, so this app can register the same high-quality sounds.
 *
 * The audio files themselves are fetched lazily by Strudel the first time a
 * sound is played; only these maps are fetched up front.
 */
export const VCSL_MAP = 'https://strudel.b-cdn.net/vcsl.json'

export const SAMPLE_PACK_URLS = [
  // Plain kit names (bd, sd, hh, oh, cp, rim, rd, ...) with several variations each.
  'https://strudel.b-cdn.net/uzu-drumkit.json',
  // 683 drum-machine samples across 71 classic machines, used through .bank().
  'https://strudel.b-cdn.net/tidal-drum-machines.json',
  // Multi-sampled concert grand, keyed per pitch.
  'https://strudel.b-cdn.net/piano.json',
  // VCSL instruments: pianos, harp, mallets, organs, winds, percussion.
  VCSL_MAP,
] as const

export type InstrumentGroup = 'Acoustic' | 'Electric' | 'Cosmic' | 'Plucked' | 'Mallet' | 'Wind'

export type InstrumentId = string

/**
 * Where an instrument is allowed to be used.
 *
 * The three pools are disjoint, and `assertStyleIsolation` in `music.ts` checks them
 * at startup. That is what keeps a lead from being the sound the chord figure is
 * already playing: an instrument is either a lead, a backing sound or a bass, never
 * two of them, and no style reuses another style's instruments either.
 */
export type InstrumentRole = 'solo' | 'backing' | 'bass'

export type Instrument = {
  id: InstrumentId
  label: string
  description: string
  group: InstrumentGroup
  role: InstrumentRole
  /** Sample-map source: the map to read and the key to look up inside it. */
  mapUrl?: string
  sample?: string
  /** Soundfont source: a `gm_` name registered by `@strudel/soundfonts`. */
  font?: string
  /**
   * Built-in oscillator source. Pads use this instead of a sample map because a pad has to be
   * there the moment the transport starts: an oscillator needs nothing fetched, nothing
   * decoded and no AudioWorklet, where a sample-map pad depends on all three.
   */
  synth?: string
  /** Recorded range, in MIDI notes. Outside it the pitch is stretched. */
  range: [number, number]
}

/** The Strudel sound an instrument plays: a soundfont, a sample, or an oscillator. */
export function instrumentSound(instrument: Instrument): string {
  return instrument.font ?? instrument.sample ?? instrument.synth ?? ''
}

const GRAND_MAP = 'https://strudel.b-cdn.net/piano.json'

const sampled = (
  id: InstrumentId, label: string, description: string, group: InstrumentGroup,
  role: InstrumentRole, sample: string, range: [number, number], mapUrl = VCSL_MAP,
): Instrument => ({ id, label, description, group, role, mapUrl, sample, range })

const soundfont = (
  id: InstrumentId, label: string, description: string, group: InstrumentGroup,
  role: InstrumentRole, font: string, range: [number, number],
): Instrument => ({ id, label, description, group, role, font, range })

const oscillator = (
  id: InstrumentId, label: string, description: string, group: InstrumentGroup,
  role: InstrumentRole, synth: string, range: [number, number],
): Instrument => ({ id, label, description, group, role, synth, range })

/**
 * Every instrument the app can play, grouped by role.
 *
 * A lead is pitched so a note comes from the nearest recorded pitch rather than one
 * stretched sample. Backing sounds are the pads and figures - they carry a per-layer
 * gain, so they stay sample maps rather than soundfonts, because a soundfont trigger
 * ignores `gain` (its ADSR is fixed) and the backing is where the balance is set.
 * Bass instruments are the exception: their level comes out at the same place the
 * synth basses sat at, so a soundfont is safe there and an upright or electric bass
 * is worth far more than another oscillator.
 */
export const instruments: Instrument[] = [
  // --- Leads ----------------------------------------------------------------
  sampled('piano', 'Piano', 'concert grand', 'Acoustic', 'solo', 'piano', [21, 108], GRAND_MAP),
  sampled('harp', 'Harp', 'plucked and gentle', 'Acoustic', 'solo', 'harp', [28, 101]),
  sampled('marimba', 'Marimba', 'wooden and percussive', 'Acoustic', 'solo', 'marimba', [29, 84]),
  sampled('glockenspiel', 'Glockenspiel', 'bright metallic mallets', 'Acoustic', 'solo', 'glockenspiel', [60, 96]),
  sampled('kalimba', 'Kalimba', 'thumb piano, soft attack', 'Acoustic', 'solo', 'kalimba', [48, 84]),
  sampled('vibraphone', 'Vibraphone', 'metallic shimmer', 'Mallet', 'solo', 'vibraphone', [41, 76]),
  sampled('tubularbells', 'Tubular bells', 'deep bell strike', 'Mallet', 'solo', 'tubularbells', [48, 84]),
  sampled('handchimes', 'Handchimes', 'small bright bells', 'Mallet', 'solo', 'handchimes', [60, 96]),
  sampled('dantranh', 'Dantranh', 'zither, tremolo plucks', 'Plucked', 'solo', 'dantranh', [35, 71]),
  sampled('strumstick', 'Strumstick', 'plucked strings', 'Plucked', 'solo', 'strumstick', [38, 69]),
  soundfont('rhodes', 'Rhodes', 'electric piano, bell-like and round', 'Electric', 'solo', 'gm_epiano1', [28, 96]),
  soundfont('clean-guitar', 'Clean guitar', 'electric guitar, clean and round', 'Electric', 'solo', 'gm_electric_guitar_clean', [40, 88]),
  soundfont('jazz-guitar', 'Jazz guitar', 'hollow-body electric, warm', 'Electric', 'solo', 'gm_electric_guitar_jazz', [40, 88]),
  sampled('wineglass', 'Wineglass', 'cosmic glass tones', 'Cosmic', 'solo', 'wineglass', [63, 74]),
  sampled('ocarina', 'Ocarina', 'hollow, breathy whistle', 'Cosmic', 'solo', 'ocarina', [60, 88]),
  soundfont('voice-oohs', 'Voices', 'oohs, soft and wide', 'Cosmic', 'solo', 'gm_voice_oohs', [48, 84]),
  soundfont('flute', 'Flute', 'breathy, plain and clear', 'Wind', 'solo', 'gm_flute', [60, 96]),
  soundfont('clarinet', 'Clarinet', 'woody reed, low register', 'Wind', 'solo', 'gm_clarinet', [50, 88]),
  soundfont('muted-trumpet', 'Muted trumpet', 'tight, brassy jazz lead', 'Wind', 'solo', 'gm_muted_trumpet', [55, 84]),
  sampled('sax', 'Sax', 'reedy tenor sax', 'Wind', 'solo', 'sax', [44, 76]),

  // --- Backing (pads and figures) -------------------------------------------
  // The pads are oscillators: a pad layer must never be the thing that is missing.
  oscillator('pad-saw', 'Saw bed', 'filtered sawtooth, warm and full', 'Electric', 'backing', 'sawtooth', [36, 84]),
  oscillator('pad-square', 'Square bed', 'filtered square, reedy and hollow', 'Electric', 'backing', 'square', [36, 84]),
  oscillator('pad-triangle', 'Triangle bed', 'soft triangle, almost a breath', 'Cosmic', 'backing', 'triangle', [36, 84]),
  sampled('clavisynth', 'Clav', 'bright electric clav', 'Electric', 'backing', 'clavisynth', [12, 84]),
  sampled('fmpiano', 'FM piano', 'electric piano, DX-style', 'Electric', 'backing', 'fmpiano', [12, 96]),
  sampled('psaltery', 'Psaltery', 'plucked zither, quick decay', 'Plucked', 'backing', 'psaltery_pluck', [48, 88]),
  sampled('balafon', 'Balafon', 'wooden bars, dry and short', 'Mallet', 'backing', 'balafon', [48, 84]),
  sampled('pipeorgan_quiet', 'Quiet organ', 'soft drawbar bed', 'Acoustic', 'backing', 'pipeorgan_quiet', [36, 84]),

  // --- Bass -----------------------------------------------------------------
  soundfont('bass-pick', 'Pick bass', 'electric bass, plectrum', 'Electric', 'bass', 'gm_electric_bass_pick', [28, 60]),
  soundfont('bass-finger', 'Finger bass', 'electric bass, fingers', 'Electric', 'bass', 'gm_electric_bass_finger', [28, 60]),
  soundfont('bass-synth', 'Synth bass', 'round analogue sub', 'Electric', 'bass', 'gm_synth_bass_1', [24, 60]),
  soundfont('bass-upright', 'Upright bass', 'acoustic double bass', 'Acoustic', 'bass', 'gm_acoustic_bass', [24, 60]),
]

export function findInstrument(id: InstrumentId): Instrument {
  return instruments.find((instrument) => instrument.id === id) ?? instruments[0]
}

/** The instruments a given role may ever use. */
export function instrumentsForRole(role: InstrumentRole): Instrument[] {
  return instruments.filter((instrument) => instrument.role === role)
}

export const instrumentGroups: InstrumentGroup[] = ['Acoustic', 'Electric', 'Cosmic', 'Plucked', 'Mallet', 'Wind']

/** C3-B4: what a small MIDI keyboard sends. Adjusted in the UI or learned from playing. */
export const DEFAULT_SOLO_RANGE = { low: 48, high: 71 }

const SEMITONES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/**
 * Parses Tidal/Strudel pitch names (`c4`, `A#3`, `Ds1`, `Bb2`) into MIDI numbers.
 * `c4` is middle C (60), matching Strudel's own `note()` convention.
 */
export function noteToMidi(name: string): number | null {
  const match = /^([a-gA-G])([#sb]?)(-?\d+)$/.exec(name.trim())
  if (!match) return null
  const accidental = match[2].toLowerCase()
  const offset = accidental === '#' || accidental === 's' ? 1 : accidental === 'b' ? -1 : 0
  return (Number(match[3]) + 1) * 12 + SEMITONES[match[1].toLowerCase()] + offset
}
