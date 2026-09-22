/**
 * The vocabulary the music is described in.
 *
 * Everything here is a name or a small shared type: what a key, chord, figure, rhythm,
 * style, phrase and layer are called, what a voice may be told to sound like, and what
 * the app hands to the audio engine. Nothing here knows how a pattern is built, which is
 * what keeps this module free of dependencies and out of every cycle.
 *
 * `LAYER_ORBITS` is here for the same reason. It is a property of the arrangement rather than of
 * any one part of it, and the pattern builder, the mixer and the bar counter all have to agree on
 * it exactly. Section length used to live here too, as `PHRASE_BARS`; it is a property of the music
 * rather than of the app, so it lives on the sections themselves now and is read back with
 * `sectionBars`.
 */
import type { InstrumentId } from './samples'

export type KeyId = 'C minor' | 'D minor' | 'F minor' | 'A minor'

/** Chord ids are scale degrees of a minor key. `chords.ts` holds what each one is made of. */
export type ChordId =
  | 'i' | 'i7' | 'imaj7' | 'i64'
  | 'III'
  | 'iv' | 'iv7' | 'IV'
  | 'ii\u00f87'
  | 'V' | 'V7' | 'V7sus4'
  | 'V7/iv'
  | 'VI'
  | 'VII' | 'VII7'
  | 'bII'
export type ArpId = 'block' | 'up' | 'down' | 'broken' | 'pedal'
export type RhythmId = 'lilt' | 'pulse' | 'syncopated' | 'driving'
export type ChordModeId = 'pad' | 'arp' | 'combo'
export type StyleId = 'night-drive' | 'broken-beat' | 'slow-bloom' | 'after-hours' | 'blues'
/** Sequences belong to a style, so their ids are namespaced per style. */
export type SequenceId = string

export type Selection = {
  key: KeyId
  style: StyleId
  /** The sequence within the current style. Sequences are never shared between styles. */
  sequence: SequenceId
  chordMode: ChordModeId
  arp: ArpId
  rhythm: RhythmId
  solo: InstrumentId
  /** Key range the solo voice preloads, in MIDI notes. */
  soloLow: number
  soloHigh: number
  tempo: number
}

/**
 * The tempo range the transport offers.
 *
 * Wide enough to hold every style's own tempo rather than a range chosen first and styles fitted
 * to afterwards: a blues runs to 160 and a downtempo style sits under 80, so a transport that
 * stopped at 150 could not reach the tempos two of the styles are written for. `validate.ts`
 * checks each style's tempo is inside this, because a default outside it is unreachable.
 */
export const TEMPO_RANGE = { min: 60, max: 180 } as const

export const chordModes: { id: ChordModeId; label: string; description: string }[] = [
  { id: 'pad', label: 'Pads', description: 'sustained chord bed' },
  { id: 'arp', label: 'Arpeggio', description: 'chord played as a figure' },
  { id: 'combo', label: 'Combo', description: 'pad plus figure' },
]

/**
 * The parts the mixer can silence. `solo` is the live keys rather than a pattern
 * layer, so it has no orbit of its own - it is the one part this app plays itself.
 */
export type LayerId = 'drums' | 'perc' | 'bass' | 'pad' | 'chords' | 'solo'

/**
 * One Strudel orbit per pattern layer, which is what makes mute and solo possible.
 * An orbit's `output` is a real GainNode, so a part can be silenced or brought back
 * while a note is still ringing: nothing is re-evaluated and the phrase plays on
 * undisturbed. Orbit 0 is left alone - it is Strudel's default, and the lead, which
 * is not a pattern layer at all, shares it.
 *
 * Every layer needs its OWN number, because the mixer reaches a layer by writing the gain of the
 * orbit it plays in. The percussion used to share the drums' orbit, and that is not a saving: two
 * layers on one orbit can only ever be silenced together, and the percussion had no layer id, so
 * there was no row to reach it by and no way to trim it either. Orbit 5 is skipped because analyser
 * ids and orbit numbers share one space and 5 is the live keys' analyser.
 */
export const LAYER_ORBITS: Record<Exclude<LayerId, 'solo'>, number> = {
  drums: 1,
  bass: 2,
  pad: 3,
  chords: 4,
  perc: 6,
}

export type Layer = {
  id: LayerId
  name: string
  detail: string
  notes: string
  /**
   * The same notes, one entry per section of the form.
   *
   * A form is thirty-two bars, so a layer's notes for the whole of it are a wall of text and
   * tell the player nothing about the bar they are on. Grouped by section, the panel can show
   * the eight bars being played. Empty for a layer that does not vary by section, like the drums.
   */
  sectionNotes: string[]
}
export type Bar = { chordLabel: string; notes: string }

/**
 * One superdough voice. When `sample` is set the layer plays a sample with
 * `note()`, otherwise `synth` selects one of the built-in oscillators.
 */
export type Sound = {
  sample?: string
  synth?: string
  /** Required when `synth` is `user` - superdough warns and falls back to triangle without it. */
  partials?: number[]
  /**
   * Detune spread across the voices of an oscillator that has voices to spread, in semitones.
   *
   * Only `supersaw` has them: it is one worklet carrying five oscillators, and this is the total
   * spread from the lowest to the highest, so 0.18 puts them either side of the root at +/-9 cents.
   * It halves the per-voice level as it adds voices, so a wider spread is width and not volume. Set
   * on a single oscillator it is nothing at all, because there is one voice and nothing to move it
   * away from itself.
   */
  detune?: number
  lpf?: number
  lpq?: number
  /**
   * Filter envelope. It only does anything alongside `lpf`: superdough builds the filter
   * chain when a cutoff is present, and ignores the envelope controls entirely without
   * one, so an envelope on a layer with no cutoff is silently nothing. Asserted below.
   *
   * `lpenv` is how far the cutoff opens, in octaves, so it means the same thing at any
   * tempo. The filter sweeps between `lpf` and `lpf * 2 ** lpenv`, and `lpd`/`lps` bring
   * it back down to settle. A negative value closes instead of opening.
   */
  lpenv?: number
  /** Filter attack, in seconds. Long enough and a held chord opens as it sounds. */
  lpa?: number
  /** Filter decay, and the level it settles to: `lps` of the way from `lpf` to the peak. */
  lpd?: number
  lps?: number
  attack?: number
  release?: number
  room?: number
  delay?: number
  distort?: number
  gain?: number
}

/** A layer's instrument plus the tone a style plays it with. */
export type StyleLayer = {
  instrument: InstrumentId
  /** See `Sound`: the detune spread, which only a voice-carrying oscillator can use. */
  detune?: number
  lpf?: number
  lpq?: number
  /** See `Sound`: the filter envelope, which needs `lpf` to mean anything. */
  lpenv?: number
  lpa?: number
  lpd?: number
  lps?: number
  attack?: number
  release?: number
  room?: number
  delay?: number
  distort?: number
  gain?: number
}

/**
 * Which bars of a section a layer plays in, as one digit per bar of the section.
 *
 * The mask must divide the form, so the usual value is as long as one section and repeats with it.
 *
 * This is the arranging device a pattern needs and harmony cannot supply: the chords say
 * what is happening, and this says who is in the room. Only the two decorative layers are
 * ever listed. The drums, the bass and the pad play throughout, because a phrase that
 * silences its own foundation reads as a mistake rather than as an arrangement, and
 * because the pad is what covers the hole the other two leave.
 *
 * The mask is emitted as a per-cycle pattern, and one cycle is one bar - the same grid the
 * app counts bars on (`cycle % bars`). So a bar's place in the phrase and its place in the
 * mask agree by construction, including mid-handoff, where the incoming phrase is placed
 * at the cycle its own first bar falls on.
 */
export type Arrangement = Partial<Record<'drums' | 'perc' | 'bass' | 'pad' | 'chords', string>>

/**
 * A phrase change that has been decided but has not arrived yet.
 *
 * The program is rebuilt the moment the change is known, not when it is due, and the
 * rebuild carries the phrase that is playing as well as the one taking over, laid out by
 * cycle number. Strudel plays a slowcat by cycle, so the switch then happens at the bar
 * line because of where the bars sit in the pattern - not because of when `evaluate` was
 * called. Applying it at the bar line instead was audible: the boundary had already been
 * scheduled from the old program, so the first beat of the new phrase came out as the old
 * one and the change only arrived on the next event.
 */
export type Handoff = {
  /** The phrase playing now. Its remaining bars are kept, so nothing changes early. */
  from: SequenceId
  /** The phrase that takes over at the next bar line. */
  to: SequenceId
  /** The cycle that was sounding when the change was decided. */
  cycle: number
}

/**
 * A section's length belongs to the section, not to the app.
 *
 * The unit of this music is the section, and a section is however many bars the form it belongs to
 * actually needs: eight for a house or garage phrase, twelve for a blues, whatever a standard
 * wants. There used to be one `PHRASE_BARS = 8` here that everything assumed, which meant the blues
 * had to be squeezed into eight bars when its form is twelve. Anything that needs the length now
 * asks for it - `sectionBars` on the plan, or `chartSections` on a style - and `validate.ts` checks
 * the lengths of each style's own sections rather than comparing them all to a constant.
 */

export type ChordBar = ChordId | [ChordId, ChordId]

/**
 * One section: chords, written as a phrase rather than a loop.
 *
 * Every sequence belongs to exactly one style, and no two sequences *within* a style open
 * on the same chord. That is what lets Jev choose the next chord and have exactly one
 * sequence answer for it, so the harmonic decision and the arrangement stay in step.
 *
 * A bar holds one chord, or two when the harmony should move twice as fast.
 */
export type Sequence = {
  id: SequenceId
  label: string
  /** What this phrase does harmonically. Used verbatim as Jev's option description. */
  effect: string
  bars: ChordBar[]
}

/**
 * One arrangement. Everything a style plays is its own: its sequences, its chord
 * palette, its drum machine and its four instruments. Nothing is shared between
 * styles, so no choice inside a style can turn it into a different one.
 *
 * Which of those rules are enforced, and where, is in `validate.ts`.
 */
export type Style = {
  id: StyleId
  label: string
  description: string
  /** This style's own phrases. No two of them open on the same chord. */
  sequences: Sequence[]
  /**
   * The chart: the order this style's phrases are played in, as one repeating form.
   *
   * A phrase is a section, and a form is several sections in a fixed order - which is what
   * makes the music playable rather than merely followable. The form is what the player commits
   * to and counts on; a phrase on its own is not a form, it is a loop, and eight bars is not
   * long enough to settle into. `form` is treated as a cycle: the last section leads back to
   * the first. Each style may be a different length, and each of its sections may be too - the
   * length in bars is the sum of the sections' own, four eights for a dance phrase and three
   * twelves for a blues - and `validate.ts` checks that every consecutive pair, including the
   * wrap, resolves.
   *
   * Deliberately the same phrases as `sequences` rather than new music: the form is an
   * arrangement of the material, not more of it.
   */
  form: SequenceId[]
  /** The chords this style is allowed to use. Every sequence chord must appear here. */
  palette: ChordId[]
  /**
   * The tempo this style is written for, in BPM.
   *
   * A style is a tempo as much as it is a chord palette. Eighty beats per minute of house is not
   * house, and a downtempo style at a dance tempo is not downtempo - the tempo decides which feel
   * is even available, which is why it comes second in the order of decisions rather than last. So
   * it belongs to the style, the way its kit and its palette do, and the transport follows the
   * style until the player takes the tempo over by hand.
   */
  tempo: number
  drums: {
    /**
     * The kit's voices, each with its own level.
     *
     * One `s()` call per voice rather than one comma-separated pattern, because the balance *inside*
     * a kit is not something the kit's own gain can express. Measured against the banks this repo
     * uses, the MPC60 snare stands 2.7x above its own kick, the LinnDrum hi-hat playing straight
     * eighths was 83% of the blues' drum bus, and the R-8 ride at five to the bar was 97% of
     * after-hours' - and a voice that far above its own kick cannot be fixed by turning the kit
     * down, because that turns the kick down with it. A mix that is wrong inside one layer is wrong
     * at every level that layer can be set to.
     *
     * `gain` is the voice's balance within the kit; the kit's own `gain` stays what it was, the kit's
     * level against the rest of the arrangement. It is a trim and not a volume - a voice wanting to
     * sit above unity means the kit is set too low - so it belongs to the voices that need one and
     * is left off the ones that do not, which keeps a stated level a decision rather than a number
     * copied down five styles for the sake of the shape.
     */
    voices: { pattern: string; gain?: number }[]
    bank?: string
    gain: number
    lpf?: number
    /**
     * Added on the last bar of every section, on top of the groove - one entry per pass.
     *
     * A form is thirty-two bars, which is far too long to hold your place in by counting, so the
     * arrangement has to tell the player where they are instead. This is the small cue: a pickup
     * on the last bar of a section, so a section end sounds like a section end.
     *
     * A list rather than one pattern, because a landmark in the same place is a landmark and a
     * landmark that never changes is wallpaper. The entries are used one per pass through the form
     * and cycle, so the cue *moves* every time the form comes round while staying exactly where it
     * was: the player still knows which bar they are on, and the second time round does not sound
     * like the first. Two entries cover the window between the form settling and the form moving,
     * which is what `HOLD_FORMS` schedules.
     */
    fill: string[]
    /**
     * Added on the last bar of the whole form - the same idea one level up, and a different shape.
     *
     * The two have to be told apart by ear rather than by working it out, so they cannot be the
     * same pattern (`assertCuesAreDistinct` refuses it): the section cue is a gesture, and this is
     * the top of the cycle coming round.
     */
    turn: string
  }
  perc: { pattern: string; bank?: string; gain: number }
  /** Tokens: `1` bass note, `3` third, `5` fifth, `8` bass an octave up, `~` rest. */
  bass: StyleLayer & { template: string }
  pad: StyleLayer
  arpSound: StyleLayer
  /** Which bars of every phrase the decorative layers play in. See `Arrangement`. */
  arrangement: Arrangement
  /** This style's own leads. Never a backing sound, and never another style's. */
  solos: InstrumentId[]
  /** The lead this style opens with. */
  solo: InstrumentId
}
