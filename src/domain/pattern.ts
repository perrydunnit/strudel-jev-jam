/**
 * Turning a selection into a Strudel program.
 *
 * Every fragment comes from the tables in `styles.ts` - notes, sample names, filters and
 * the decision ids themselves are allowlisted, so no model output ever reaches
 * `evaluate()` as executable source. The live solo line is not part of this program; it is
 * played by `audio/liveVoice.ts` so that key release is honoured.
 *
 * The shape of the program is one `const` per voice and a final `stack`. One voice per
 * layer is what lets the panel show each part as its own line, and what lets each view be
 * read against the thing it draws.
 */
import { chordNotes, chordSymbol, findChord, pitch } from './chords'
import { arpTokens, findArp, findRhythm, type Arp, type Rhythm } from './figures'
import { findSequence, findStyle } from './styles'
import {
  LAYER_ORBITS,
  type Bar,
  type ChordId,
  type Handoff,
  type Layer,
  type LayerId,
  type Selection,
  type SequenceId,
  type Style,
} from './vocabulary'
import {
  bassSteps,
  describePresence,
  feelCode,
  group,
  layerLabel,
  layerSound,
  maskCode,
  soundCode,
} from './codegen'

/** One chord of one bar, already turned into the tokens each layer plays. */
type BuiltPart = {
  label: string
  notes: string[]
  bass: string[]
  figure: { token: string; gain: number }[]
}

type BuiltBar = { parts: BuiltPart[]; label: string; notes: string; roots: string }

/** Everything building a bar needs to know, whichever phrase it belongs to. */
type Voicing = {
  style: Style
  selection: Selection
  rhythm: Rhythm
  /** The figure's own level, so its accents scale with the instrument it plays on. */
  accent: number
  bassTemplate: string[]
}

/** A voice: the line of Strudel it becomes, and the name the `stack` refers to it by. */
type Voice = { name: string; code: string }

/** A sound the arrangement will trigger, so it can be fetched before it is needed. */
export type PlanSound = { name: string; bank?: string; note?: string }

export type PatternPlan = {
  code: string
  /** The label of the sequence being played, for the readout. */
  sequenceLabel: string
  /** One entry per bar of the sequence, in playing order. */
  bars: Bar[]
  layers: Layer[]
  /** The instrument the live solo voice should use. */
  solo: Selection['solo']
  /** Sounds the arrangement will trigger, so they can be fetched up front. */
  warm: PlanSound[]
}

/**
 * Bars in a handoff program: the rest of the phrase playing now, then the incoming one.
 * It has to be a whole number of phrases, and longer than one, so the incoming phrase can
 * begin on a bar line and still have the whole of itself in front of it. Eight bars is one
 * phrase, so the handoff is two. The slot for the cycle already sounding is the only one
 * that outlives its phrase, and the app rebuilds the program without a handoff as soon as
 * the change has landed, long before the pattern comes back around.
 */
const HANDOFF_BARS = 16

/**
 * The bars the program plays, in the order the cycle counter asks for them.
 *
 * `playing` is the phrase the player is hearing - the one `buildPattern` was given, and the
 * one the readout describes. The handoff names the phrase on its way in, and its bars are
 * placed after whatever is left of the one playing, so the switch is a property of the
 * pattern rather than of when it was evaluated.
 */
function handoffBars(
  playing: BuiltBar[],
  handoff: Handoff | undefined,
  barsFor: (id: SequenceId) => BuiltBar[],
): BuiltBar[] {
  if (!handoff || handoff.to === handoff.from) return playing
  const next = barsFor(handoff.to)
  const at = ((handoff.cycle % HANDOFF_BARS) + HANDOFF_BARS) % HANDOFF_BARS
  // Bars of the phrase playing now that are still to come, the one in progress included.
  const remaining = playing.length - (((handoff.cycle % playing.length) + playing.length) % playing.length)
  return Array.from({ length: HANDOFF_BARS }, (_, slot) => {
    const ahead = ((slot - at) + HANDOFF_BARS) % HANDOFF_BARS
    return ahead < remaining
      ? playing[(handoff.cycle + ahead) % playing.length]
      : next[(ahead - remaining) % next.length]
  })
}

/**
 * The bars of one phrase, in that phrase's own order.
 *
 * Building them for any sequence, rather than only the one playing, is what lets a handoff
 * keep the phrase that is playing while the next one waits its turn.
 */
function barsFor(voicing: Voicing, id: SequenceId): BuiltBar[] {
  const { style, selection, rhythm, accent, bassTemplate } = voicing
  return findSequence(selection.style, id).bars.map((bar) => {
    const ids: ChordId[] = typeof bar === 'string' ? [bar] : bar
    // Two chords in a bar take half a bar each, so the harmony speeds up without any
    // layer losing its place. Each chord gets the opening of the bass figure, so the
    // new root still lands on the beat.
    const slots = Math.max(1, Math.floor(rhythm.slots / ids.length))
    const template = ids.length > 1
      ? bassTemplate.slice(0, Math.floor(bassTemplate.length / ids.length)).join(' ')
      : style.bass.template

    const parts = ids.map((chordId, index) => {
      const chord = findChord(chordId)
      const notes = chordNotes(chord, selection.key)
      const tokens = arpTokens(notes, selection.arp)
      const bassNote = chord.bass ?? chord.root
      return {
        label: chordSymbol(chord, selection.key),
        notes,
        bass: bassSteps(template, notes, pitch(bassNote, selection.key, 2), pitch(bassNote, selection.key, 3)),
        figure: figureEvents(tokens, rhythm, slots, index, accent),
      }
    })

    return {
      parts,
      label: parts.map((part) => part.label).join(' · '),
      notes: parts.flatMap((part) => part.notes).join(' '),
      roots: parts.map((part) => part.bass[0]).join(' '),
    }
  })
}

/** One chord's worth of figure, with an accent on every beat. Rests are positions, not notes. */
function figureEvents(tokens: string[], rhythm: Rhythm, slots: number, index: number, accent: number) {
  return Array.from({ length: slots }, (_, offset) => {
    // Rests are positions in the bar, so they survive a chord change.
    const slot = index * slots + offset
    if (rhythm.rests.includes(slot)) return { token: '~', gain: 0 }
    return { token: tokens[offset % tokens.length], gain: (slot % 4 === 0 ? 0.9 : 0.55) * accent }
  })
}

/**
 * `<...>` is a slowcat: one bar per cycle, so the sequence loops by itself and Jev can swap
 * it at a bar line without anything being rebuilt mid-bar.
 */
function slowcat(programBars: BuiltBar[], render: (bar: BuiltBar) => string): string {
  return `<${programBars.map(render).join(' ')}>`
}

/** Every layer is routed to its own orbit so the mixer can reach it. */
function orbit(id: Exclude<LayerId, 'solo'>): string {
  return `.orbit(${LAYER_ORBITS[id]})`
}

const bank = (name?: string) => (name ? `.bank("${name}")` : '')

/** The distinct sample names a pattern refers to, for warming. */
const soundNames = (pattern: string) => [...new Set(pattern.match(/[a-z][a-z0-9_]*/g) ?? [])]

function drumVoice({ style }: Voicing): Voice {
  const { drums } = style
  return {
    name: 'drums',
    code: `s("${drums.pattern}")${bank(drums.bank)}.lpf(${drums.lpf ?? 12000}).gain(${drums.gain})`
      + `${feelCode('drums')}${maskCode(style.arrangement.drums)}${orbit('drums')}`,
  }
}

function percVoice({ style }: Voicing): Voice {
  return {
    name: 'perc',
    code: `s("${style.perc.pattern}")${bank(style.perc.bank)}.gain(${style.perc.gain})`
      + `${feelCode('perc')}${maskCode(style.arrangement.perc)}${orbit('drums')}`,
  }
}

function bassVoice(voicing: Voicing, programBars: BuiltBar[]): Voice {
  const { style } = voicing
  const notes = slowcat(programBars, (bar) => group(bar.parts.map((part) => part.bass)))
  return {
    name: 'bass',
    code: `note("${notes}").${soundCode(layerSound(style.bass))}`
      + `${feelCode('bass')}${maskCode(style.arrangement.bass)}${orbit('bass')}`,
  }
}

function padVoice(voicing: Voicing, programBars: BuiltBar[]): Voice {
  const { style } = voicing
  const notes = slowcat(programBars, (bar) => group(bar.parts.map((part) => [part.notes.join(',')])))
  return {
    name: 'pad',
    // `.clip(1)` cuts the chord at its own duration, so the pad cannot ring over the next
    // one. `.analyze` taps the layer into the analyser its spectrum view reads; it does not
    // change the sound, and it is the same mechanism Strudel's own scopes use.
    code: `note("${notes}").${soundCode(layerSound(style.pad))}.clip(1)`
      + `${maskCode(style.arrangement.pad)}${orbit('pad')}.analyze(${LAYER_ORBITS.pad})`,
  }
}

function chordVoice(voicing: Voicing, programBars: BuiltBar[]): Voice {
  const { style } = voicing
  const figureSound = layerSound(style.arpSound)
  // The gain pattern carries the accents, so the figure's own gain is left out of the sound.
  const sound = soundCode({ ...figureSound, gain: undefined })
  const notes = slowcat(programBars, (bar) => group(bar.parts.map((part) => part.figure.map((event) => event.token))))
  const gains = slowcat(programBars, (bar) => group(bar.parts.map((part) => part.figure.map((event) => event.gain.toFixed(3)))))
  return {
    name: 'chords',
    code: `note("${notes}").${sound}.gain("${gains}")`
      + `${feelCode('chords')}${maskCode(style.arrangement.chords)}${orbit('chords')}`,
  }
}

function drumsRow(style: Style, rhythm: Rhythm): Layer {
  return { id: 'drums', name: 'Drums', detail: `${style.drums.bank ?? 'uzu kit'} · ${rhythm.label}`, notes: style.drums.pattern }
}

function bassRow(style: Style, bars: BuiltBar[]): Layer {
  return { id: 'bass', name: 'Bass', detail: `${layerLabel(style.bass)} · root per chord`, notes: bars.map((bar) => bar.roots).join(' ') }
}

function padRow(style: Style, bars: BuiltBar[]): Layer {
  return { id: 'pad', name: 'Pad', detail: `${layerLabel(style.pad)} · held for one chord`, notes: bars.map((bar) => bar.label).join(' ') }
}

function chordRow(voicing: Voicing, bars: BuiltBar[], arp: Arp): Layer {
  const { style, rhythm } = voicing
  const detail = [arp.label, rhythm.label, layerLabel(style.arpSound), describePresence(style.arrangement.chords)]
  return {
    id: 'chords',
    name: 'Chords',
    detail: detail.filter(Boolean).join(' · '),
    notes: bars[0].parts.flatMap((part) => part.figure.map((event) => event.token)).join(' '),
  }
}

/**
 * Every distinct sound the arrangement can trigger, taken from what is actually rendered
 * rather than from one representative note per chord. A pitch-keyed sample map resolves a
 * different file per pitch, and a soundfont a different zone, so warming a single note of a
 * chord would still leave the others to fetch on first play.
 */
function soundsToWarm(voicing: Voicing, programBars: BuiltBar[]): PlanSound[] {
  const { style, selection } = voicing
  const warm = new Map<string, PlanSound>()
  const add = (name: string, bankName?: string, note?: string) => {
    warm.set(`${name}|${bankName ?? ''}|${note ?? ''}`, { name, bank: bankName, note })
  }

  soundNames(style.drums.pattern).forEach((name) => add(name, style.drums.bank))
  soundNames(style.perc.pattern).forEach((name) => add(name, style.perc.bank))

  const bassSample = layerSound(style.bass).sample
  const padSample = layerSound(style.pad).sample
  const figureSample = layerSound(style.arpSound).sample
  const withPad = selection.chordMode !== 'arp'
  const withFigure = selection.chordMode !== 'pad'

  programBars.forEach((bar) =>
    bar.parts.forEach((part) => {
      // The bass figure only sounds where the figure is not a rest.
      if (bassSample) part.bass.filter((note) => note !== '~').forEach((note) => add(bassSample, undefined, note))
      if (padSample && withPad) part.notes.forEach((note) => add(padSample, undefined, note))
      if (figureSample && withFigure) part.notes.forEach((note) => add(figureSample, undefined, note))
    }),
  )

  return [...warm.values()]
}

export function buildPattern(selection: Selection, handoff?: Handoff): PatternPlan {
  const style = findStyle(selection.style)
  const phrase = findSequence(selection.style, selection.sequence)
  const rhythm = findRhythm(selection.rhythm)
  const arp = findArp(selection.arp)
  const voicing: Voicing = {
    style,
    selection,
    rhythm,
    accent: style.arpSound.gain ?? 0.5,
    bassTemplate: style.bass.template.split(/\s+/),
  }

  // `bars` describes the phrase the player is hearing; `programBars` is what the program
  // contains, which during a handoff also holds the incoming phrase.
  const bars = barsFor(voicing, selection.sequence)
  const programBars = handoffBars(bars, handoff, (id) => barsFor(voicing, id))

  const voices: Voice[] = [drumVoice(voicing), percVoice(voicing), bassVoice(voicing, programBars)]
  const layers: Layer[] = [drumsRow(style, rhythm), bassRow(style, bars)]

  if (selection.chordMode !== 'arp') {
    voices.push(padVoice(voicing, programBars))
    layers.push(padRow(style, bars))
  }
  if (selection.chordMode !== 'pad') {
    voices.push(chordVoice(voicing, programBars))
    layers.push(chordRow(voicing, bars, arp))
  }

  return {
    code: [
      // One variable per voice, so the panel can show each layer as its own line and each
      // view can be read against the thing it draws. The last statement is the pattern,
      // which is what the transpiler returns to the scheduler.
      ...voices.map((voice) => `const ${voice.name} = ${voice.code}`),
      '',
      `stack(${voices.map((voice) => voice.name).join(', ')}).cps(${(selection.tempo / 240).toFixed(6)})`,
    ].join('\n'),
    sequenceLabel: phrase.label,
    bars: bars.map((bar) => ({ chordLabel: bar.label, notes: bar.notes })),
    layers,
    solo: selection.solo,
    warm: soundsToWarm(voicing, programBars),
  }
}
