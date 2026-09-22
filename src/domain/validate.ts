/**
 * The invariants the arrangement has to satisfy.
 *
 * Every rule here exists because breaking it produced something that was wrong in a way
 * that was either hard to hear or expensive to find: a figure on a triplet grid, a phrase
 * of the wrong length, two styles sharing an instrument, a filter envelope with nothing to
 * move. They run at import and they throw, because a violation is a bug in the tables and
 * the tables are cheaper to check than the audio is to debug.
 *
 * The tables are *arguments* rather than imports. That keeps this module dependent on
 * nothing but the vocabulary, so it cannot take part in an import cycle, and it makes each
 * rule something a test can point at any set of styles.
 */
import { instrumentSound, findInstrument } from './samples'
import { chordRole, closingChord, findChord, openingChord, padOffsets } from './chords'
import type { Rhythm } from './figures'
import type { ChordBar, ChordId, Style, StyleId } from './vocabulary'
import { LAYER_ORBITS, TEMPO_RANGE } from './vocabulary'

/**
 * Every layer sits on a straight sixteenth grid, so a figure's slot count has to divide
 * `grid`. If it does not, the chord figure lands between the drum hits - a 3:2 polyrhythm -
 * and the drums sound like they are rushing or dragging against the chords. This caught a
 * real bug: slots of 3, 6 and 12 meant three of the four rhythms were triplets against
 * straight drum patterns.
 */
export function assertRhythmsDivideTheGrid(rhythms: Rhythm[], grid: number): void {
  rhythms.forEach((rhythm) => {
    if (grid % rhythm.slots !== 0) {
      throw new Error(`${rhythm.id} has ${rhythm.slots} slots in a bar, which does not divide ${grid}`)
    }
    rhythm.rests.forEach((rest) => {
      if (rest < 0 || rest >= rhythm.slots) throw new Error(`${rhythm.id} rests at ${rest}, outside its bar`)
    })
  })
}

/**
 * A section is as long as its own music, within reason.
 *
 * There used to be one length for the whole catalogue, which forced the blues into eight bars when
 * its form is twelve. Now a section says how long it is, and the only things asked of it are that
 * it is long enough to be a phrase rather than a bar count with pretensions, and that it is an even
 * number of bars - because a phrase is an antecedent plus a consequent, and `assertPhrasesDevelop`
 * compares the two halves of one.
 */
export function assertSectionsAreWellFormed(styles: Style[]): void {
  styles.forEach((style) => {
    style.sequences.forEach((sequence) => {
      const bars = sequence.bars.length
      if (bars < 4) throw new Error(`${sequence.id} is ${bars} bars, too short to be a section`)
      if (bars % 2 !== 0) {
        throw new Error(`${sequence.id} is ${bars} bars, and a phrase has to halve into an antecedent and a consequent`)
      }
    })
    const form = style.form.reduce((total, id) => {
      const section = style.sequences.find((sequence) => sequence.id === id)
      return total + (section ? section.bars.length : 0)
    }, 0)
    if (form < 8) throw new Error(`${style.id}'s form runs for ${form} bars, which is not a form`)
  })
}

/**
 * A filter envelope needs a cutoff to move. superdough builds the filter chain only when
 * one is set, and ignores the envelope controls entirely without it, so an envelope on a
 * layer with no `lpf` is silently nothing: a layer that looks like it should be moving and
 * is not. Refusing at import is cheaper than hearing it and wondering.
 */
export function assertFilterEnvelopesHaveCutoffs(styles: Style[]): void {
  styles.forEach((style) => {
    ([['bass', style.bass], ['pad', style.pad], ['figure', style.arpSound]] as const).forEach(([name, layer]) => {
      const shaped = layer.lpenv !== undefined || layer.lpa !== undefined
        || layer.lpd !== undefined || layer.lps !== undefined
      if (shaped && layer.lpf === undefined) {
        throw new Error(`${style.id}: the ${name} has a filter envelope but no cutoff, so the envelope would do nothing`)
      }
    })
  })
}

/**
 * An arrangement is one digit per bar, and its length has to divide the form.
 *
 * Dividing rather than equalling is what lets a gesture belong to a *section*: a mask as long as a
 * section repeats in every section, so "the figure steps out at the halfway point" keeps meaning
 * the halfway point of the section all the way through. Dividing is also what keeps the mask
 * aligned with the bars when the form wraps - a length that did not divide it would drift a little
 * further every time round.
 *
 * Every section must still contain something. A layer silent for a whole section is not an
 * arrangement, it is a layer that should not be in the style.
 */
export function assertArrangementsAreWellFormed(styles: Style[]): void {
  styles.forEach((style) => {
    const sections = style.form.map((id) => style.sequences.find((sequence) => sequence.id === id))
    const form = sections.reduce((total, section) => total + (section ? section.bars.length : 0), 0)
    Object.entries(style.arrangement).forEach(([layer, mask]) => {
      if (mask === undefined) return
      if (!/^[01]+$/.test(mask)) throw new Error(`${style.id}: the ${layer} arrangement is not 0s and 1s: "${mask}"`)
      if (form % mask.length !== 0) {
        throw new Error(
          `${style.id}: the ${layer} arrangement covers ${mask.length} bars, which does not divide the ${form}-bar form, so it would drift against the sections`,
        )
      }
      let at = 0
      sections.forEach((section) => {
        const bars = section ? section.bars.length : 0
        const window = Array.from({ length: bars }, (_, offset) => mask[(at + offset) % mask.length])
        if (!window.includes('1')) {
          throw new Error(`${style.id}: the ${layer} arrangement is silent for all of ${section ? section.id : 'a section'}`)
        }
        at += bars
      })
    })
  })
}

/**
 * The form has to flow: every section's last bar must land somewhere the next section can follow,
 * including the wrap from the last section back to the first.
 *
 * This is the rule that makes the music playable. The form is what a player commits to and counts
 * on, so a seam that promises a resolution it does not make leaves them unable to hear where the
 * next section begins - which is the difference between a chart and a run of unrelated loops. The
 * form is a cycle, so the wrap counts as a seam like any other.
 *
 * A tonic ending is always fine, because anything can follow the tonic. A dominant ending is fine
 * only when the next section opens on the tonic, because a dominant *promises* the tonic. A colour
 * ending is fine when the next section opens on the tonic - the modal cadence - or on another
 * colour chord, which is a modal step and the ordinary way one modal section follows another. A
 * subdominant ending needs the tonic or the dominant.
 *
 * An earlier version of this asked whether a phrase could loop into *itself*. That was the right
 * question while a phrase was the whole form and the wrong one afterwards: a phrase is a section
 * now, and what has to hold is the chart.
 */
export function assertChartFlows(styles: Style[]): void {
  styles.forEach((style) => {
    const byId = new Map(style.sequences.map((sequence) => [sequence.id, sequence]))
    style.form.forEach((id, index) => {
      const here = byId.get(id)
      const there = byId.get(style.form[(index + 1) % style.form.length])
      if (!here || !there) return
      const end = closingChord(here)
      const opening = openingChord(there)
      const from = chordRole(end)
      const to = chordRole(opening)
      const flows = from === 'tonic'
        || (from === 'dominant' && to === 'tonic')
        || (from === 'colour' && (to === 'tonic' || to === 'colour'))
        || (from === 'subdominant' && (to === 'tonic' || to === 'dominant'))
      if (!flows) {
        throw new Error(
          `${style.id}: ${here.id} ends on ${end} (${from}) and ${there.id} opens on ${opening} (${to}), so the form breaks there`,
        )
      }
    })
  })
}

/**
 * The cues have to be tellable apart by ear.
 *
 * A jammer is not going to count thirty-two bars. The arrangement marks the section ends and the
 * form end with drum cues instead, and the whole value of that is that they sound different - a
 * section end has to sound like a section end and the top of the cycle has to sound like the top of
 * the cycle. Identical cues would leave the player with the work they were given the cues to avoid,
 * so the check is worth more than the line it costs.
 *
 * Every variant counts, not just the first. A style may now carry several section cues and use one
 * per pass, and a variant that repeated another variant, or the turn, would tell the player the
 * wrong thing rather than merely sounding repetitive - the pass that was meant to sound different
 * would sound like the top of the cycle.
 */
export function assertCuesAreDistinct(styles: Style[]): void {
  styles.forEach((style) => {
    const playable = (pattern: string) => pattern.match(/[a-z][a-z0-9_]*/g) ?? []
    const { fill, turn } = style.drums
    if (!fill.length) throw new Error(`${style.id} has no section cue at all`)
    const seen = new Map<string, string>()
    fill.forEach((pattern, pass) => {
      if (!playable(pattern).length) {
        throw new Error(`${style.id} has a section cue with no sounds in it: "${pattern}"`)
      }
      const owner = seen.get(pattern)
      if (owner) throw new Error(`${style.id} uses the same section cue for ${owner} and pass ${pass + 1}`)
      seen.set(pattern, `pass ${pass + 1}`)
    })
    if (!playable(turn).length) throw new Error(`${style.id} has a form cue with no sounds in it: "${turn}"`)
    const clash = fill.find((pattern) => pattern === turn)
    if (clash) {
      throw new Error(`${style.id} ends a section and ends its form with the same cue, so the two cannot be told apart`)
    }
  })
}

/**
 * A style's own tempo has to be reachable from the transport.
 *
 * The tempo belongs to the style now, and the transport offers a range - so a style written for a
 * tempo outside that range could never be played at its own tempo, and the default would be a lie.
 * Whole numbers only, because the transport is a slider in beats per minute.
 */
export function assertTemposArePlayable(styles: Style[]): void {
  styles.forEach((style) => {
    if (!Number.isInteger(style.tempo)) throw new Error(`${style.id}'s tempo is ${style.tempo}, which is not a whole number of beats`)
    if (style.tempo < TEMPO_RANGE.min || style.tempo > TEMPO_RANGE.max) {
      throw new Error(
        `${style.id} is written for ${style.tempo} BPM, outside the transport's ${TEMPO_RANGE.min}-${TEMPO_RANGE.max}, so it cannot be played at its own tempo`,
      )
    }
  })
}

/**
 * The pad has to be voiced open rather than closed.
 *
 * Every chord in the table is written in closed root position, and pitched as written they all sit
 * inside a seventh in one octave - so a form moved by a step or two in the middle of the texture and
 * nothing else changed, and a closed triad also hides the one note that says whether the chord is
 * major or minor. `padVoicing` raises the second voice from the bottom by an octave, and these two
 * checks are what "open" means: the chord spans more than an octave, and its lowest interval is a
 * fourth or wider, so the bottom of the pad is not a stack of thirds.
 *
 * It is a rule about the table rather than about taste. A chord added in closed position fails here
 * at import, where it is cheap to see, instead of sounding thin in one style's pad.
 */
export function assertPadVoicingsAreOpen(styles: Style[]): void {
  const checked = new Set<ChordId>()
  styles.forEach((style) => {
    style.sequences.forEach((sequence) => {
      sequence.bars.flat().forEach((id) => {
        if (checked.has(id)) return
        checked.add(id)
        const offsets = padOffsets(findChord(id))
        const span = offsets[offsets.length - 1] - offsets[0]
        if (span < 12) {
          throw new Error(`${id} is voiced inside ${span} semitones, so the pad plays it closed rather than open`)
        }
        const lowest = offsets[1] - offsets[0]
        if (lowest < 5) {
          throw new Error(`${id}'s lowest interval is ${lowest} semitones, so the bottom of the pad is a stack of thirds`)
        }
      })
    })
  })
}

/**
 * Every layer needs its own orbit, because the mixer reaches a layer by writing the gain of the
 * orbit it plays in.
 *
 * This is not tidiness. The percussion used to play in the drums' orbit, so the two could only ever
 * be silenced together - muting the drums silenced the percussion with it - and since `perc` was not
 * a layer id at all there was no row to reach it by and no way to trim it. Nothing threw and nothing
 * looked wrong: two parts simply behaved as one, and the only evidence was a measurement that would
 * not come out at the level the switches claimed.
 */
export function assertLayerOrbitsAreDistinct(): void {
  const owner = new Map<number, string>()
  Object.entries(LAYER_ORBITS).forEach(([layer, orbit]) => {
    const other = owner.get(orbit)
    if (other) throw new Error(`${layer} and ${other} both play in orbit ${orbit}, so the mixer cannot tell them apart`)
    owner.set(orbit, layer)
  })
}

/**
 * A voice's level balances it against the rest of its kit, so it can only ever be a trim.
 *
 * The point of the field is that a kit's voices are not equal and the balance between them cannot be
 * expressed by the kit's own gain. That argument only holds in one direction: a voice asking to sit
 * above unity means the kit's gain is too low and the other voices are carrying the cost, which is
 * the same fault - a balance decided in the wrong place - arrived at from the other side. A voice
 * that genuinely needs to be louder than its kit is a kit with one voice, and that one voice needs no
 * entry at all.
 */
export function assertVoiceGainsAreTrims(styles: Style[]): void {
  styles.forEach((style) => {
    style.drums.voices.forEach((voice) => {
      if (voice.gain === undefined) return
      if (!(voice.gain > 0) || voice.gain > 1) {
        throw new Error(
          `${style.id}: its drum voice "${voice.pattern}" is set to ${voice.gain}, but a voice's level is a balance inside the kit and can only trim - raise the kit's own gain instead`,
        )
      }
    })
  })
}

/**
 * Every drum and percussion voice has to divide the bar evenly.
 *
 * A voice written as three tokens is a voice in three: the bar is cut into thirds and every onset
 * lands between the sixteenths. Against a backbeat in two that is a permanent 3:2 polyrhythm, which
 * does not sound syncopated, it sounds broken - and not in the way the style it belongs to is named
 * after. It is the same fault as the one that put the chord figures on a triplet grid, one layer
 * down, and it survived because nothing was checking the drum patterns themselves: the grid rule
 * only ever looked at the figure rhythms.
 *
 * The check is on the *top-level* token count of each comma-separated voice, and it asks for a power
 * of two. That is exactly the condition for equal division to stay on the sixteenth grid, and it
 * leaves nested groups, repeats and euclid rhythms alone: `[~ bd]` is one token that subdivides in
 * two, and `rim(3,8)` is one token that cuts the bar into eight.
 */
export function assertPatternsDivideTheBar(styles: Style[]): void {
  styles.forEach((style) => {
    const patterns: [string, string][] = [
      ...style.drums.voices.map((voice): [string, string] => ['drums', voice.pattern]),
      ['perc', style.perc.pattern],
      ...style.drums.fill.map((fill, pass): [string, string] => [`section cue ${pass + 1}`, fill]),
      ['form cue', style.drums.turn],
    ]
    patterns.forEach(([name, pattern]) => {
      pattern.split(',').forEach((voice) => {
        const tokens = topLevelTokens(voice)
        if (tokens.length === 0) return
        if ((tokens.length & (tokens.length - 1)) !== 0) {
          throw new Error(
            `${style.id}: its ${name} voice "${voice.trim()}" is in ${tokens.length}, which does not divide the bar, so its onsets land between the sixteenths`,
          )
        }
      })
    })
  })
}

/**
 * A voice's tokens, counted at bracket depth zero.
 *
 * `~ ~ [~ sd] [sd sd]` is four tokens, not six: the space inside `[~ sd]` separates two halves of
 * one group. Splitting on whitespace alone would score it six and call a correct pattern broken,
 * which is exactly what happened the first time this check was written.
 */
function topLevelTokens(voice: string): string[] {
  const tokens: string[] = []
  let depth = 0
  let current = ''
  const open = '[({<'
  const close = '])}>'
  for (const character of voice) {
    if (open.includes(character)) depth += 1
    if (close.includes(character)) depth -= 1
    if (/\s/.test(character) && depth === 0) {
      if (current) tokens.push(current)
      current = ''
    } else {
      current += character
    }
  }
  if (current) tokens.push(current)
  return tokens
}

/**
 * No two halves of a style's form may be the same four bars.
 *
 * A phrase can be well formed on its own and still be half of another phrase, and then the form is
 * not four sections, it is two sections plus two of their halves said again. The per-phrase rule
 * cannot see this - it only ever looks inside one phrase - and both faults found by auditing the
 * catalogue were of this kind: after-hours had two sections built on the same four bars, and three
 * of the four blues sections shared their second half.
 */
export function assertSectionsDiffer(styles: Style[]): void {
  styles.forEach((style) => {
    const seen = new Map<string, string>()
    style.sequences.forEach((sequence) => {
      const bars = sequence.bars.map((bar) => (Array.isArray(bar) ? bar.join('+') : bar))
      const half = bars.length / 2
      const halves: [string, string[]][] = [
        ['first', bars.slice(0, half)],
        ['second', bars.slice(half)],
      ]
      halves.forEach(([which, unit]) => {
        const key = unit.join(' ')
        const owner = seen.get(key)
        if (owner) {
          throw new Error(
            `${style.id}: the ${which} half of ${sequence.id} is the same four bars as ${owner}, so the form is not four sections`,
          )
        }
        seen.set(key, `${sequence.id}'s ${which} half`)
      })
    })
  })
}

/**
 * No two *neighbouring* four-bar units of a form may be the same unit twice.
 *
 * A unit is the same unit entered at a different point - `i VII VI V7sus4` and `VII VI V7sus4 i`
 * are one loop, not two - and `assertPhrasesDevelop` rejects exactly that inside a section. It
 * cannot see it across a seam, and `assertSectionsDiffer` only ever compares units for equality, so
 * a rotation shared between two sections was invisible to both: slow-bloom's Andalusian stated
 * `VI III i VII` as its second half and the next section opened on `III i VII VI`, which is eight
 * consecutive bars of one four-bar loop. Measured, that sounds like the arrival failing - the ear
 * waits four bars for something it has already heard.
 *
 * The units are read in the order they will be heard, two per section, and the wrap is a
 * neighbour too, because the form is a cycle. Only neighbours: the same unit stated again later in
 * the form is a reprise, which is a different thing and a legitimate one. Identity remains a fault
 * anywhere, which is what `assertSectionsDiffer` above is for.
 */
export function assertNeighboursDiffer(styles: Style[]): void {
  styles.forEach((style) => {
    const byId = new Map(style.sequences.map((sequence) => [sequence.id, sequence]))
    const units = style.form.flatMap((id) => {
      const sequence = byId.get(id)
      if (!sequence) return []
      const bars = sequence.bars.map((bar) => (Array.isArray(bar) ? bar.join('+') : bar))
      const half = bars.length / 2
      return [
        { owner: `${id} first half`, bars: bars.slice(0, half) },
        { owner: `${id} second half`, bars: bars.slice(half) },
      ]
    })
    units.forEach((unit, index) => {
      const next = units[(index + 1) % units.length]
      const rotations = unit.bars.map((_, at) => [...unit.bars.slice(at), ...unit.bars.slice(0, at)].join(' '))
      if (rotations.includes(next.bars.join(' '))) {
        throw new Error(
          `${style.id}: ${unit.owner} and ${next.owner} are the same bars - ${unit.bars.join(' ')} - entered at a different point, so eight bars of the form state one unit`,
        )
      }
    })
  })
}

/**
 * A form has to be a form.
 *
 * At least two sections, because one section played round and round is a loop and not a form. Every
 * name in it the style's own, or the form would reach outside the style it belongs to. And every
 * phrase the style owns used at least once, because a phrase that no form ever plays is material
 * the style does not actually have - it would sit in the phrase list looking like an option while
 * being unreachable.
 */
export function assertFormsAreWellFormed(styles: Style[]): void {
  styles.forEach((style) => {
    if (style.form.length < 2) {
      throw new Error(`${style.id} has a form of ${style.form.length} section, which is a loop rather than a form`)
    }
    const own = new Set(style.sequences.map((sequence) => sequence.id))
    style.form.forEach((id) => {
      if (!own.has(id)) throw new Error(`${style.id} has a form naming ${id}, which is not one of its phrases`)
    })
    style.sequences.forEach((sequence) => {
      if (!style.form.includes(sequence.id)) {
        throw new Error(`${style.id} owns ${sequence.id} but its form never plays it, so it is unreachable`)
      }
    })
  })
}

/**
 * A phrase has to develop, not repeat itself.
 *
 * These phrases were first written as "state it, then state it again", and half of them came
 * out as a four-bar loop played twice: nine of the sixteen repeated three of their four bars
 * between the halves, and they sounded like it. An eight-bar phrase is long enough to need a
 * second idea, so a half may echo the *framing* bars - the opening and the close - and no more
 * than that. Six of them now share nothing at all.
 */
export function assertPhrasesDevelop(styles: Style[]): void {
  styles.forEach((style) => {
    style.sequences.forEach((sequence) => {
      const half = sequence.bars.length / 2
      const ids = (bar: ChordBar) => (Array.isArray(bar) ? bar : [bar]).join('+')
      const bars = sequence.bars.map(ids)
      const first = bars.slice(0, half)
      const second = bars.slice(half)
      const repeated = first.filter((bar, index) => bar === second[index]).length
      if (repeated > 2) {
        throw new Error(
          `${sequence.id} repeats ${repeated} of its ${half} bars between the halves, so it is a loop rather than a phrase`,
        )
      }
      // A rotation is the same loop entered at a different point, which is the same fault in a
      // disguise the positional check cannot see: `i VI iiø7 V7 | iiø7 V7 i VI` shares no bar
      // with itself position by position, and is still four bars of music played twice. It sounds
      // like it, too - the hearer gets four bars where nothing new happens and a dominant at the
      // halfway point that resolves to the subdominant instead of the tonic it promised.
      const rotations = first.map((_, at) => [...first.slice(at), ...first.slice(0, at)].join('|'))
      if (rotations.includes(second.join('|'))) {
        throw new Error(
          `${sequence.id} states the same ${half}-bar loop twice, the second time entered at a different point, so it is a loop rather than a phrase`,
        )
      }
    })
  })
}

/**
 * Every style needs a home: exactly one phrase that opens on the tonic.
 *
 * A jam starts at home. The first chord of a form is the one that says where the key is, and
 * everything after it is heard against it. A style with no tonic opening cannot be entered
 * gracefully - the player is dropped into a phrase that establishes nothing - and a style with
 * two would make "home" ambiguous for the phrase list and for the candidate set, which relies on
 * no two phrases opening on the same chord.
 */
export function assertEveryStyleHasAHome(styles: Style[]): void {
  styles.forEach((style) => {
    const homes = style.sequences.filter((sequence) => chordRole(openingChord(sequence)) === 'tonic')
    if (homes.length !== 1) {
      throw new Error(
        `${style.id} has ${homes.length} phrases opening on the tonic, so it has no single home to start from`,
      )
    }
  })
}

/**
 * The styles are meant to be self-contained, so nothing may be shared: not an instrument,
 * not a drum machine, and not a sequence. A duplicated instrument is how one style would
 * drift into another's sound, and two sequences opening on the same chord would make Jev's
 * next-chord candidates ambiguous.
 */
export function assertStyleIsolation(styles: Style[]): void {
  const owners = new Map<string, string>()
  const claim = (kind: string, value: string, style: StyleId) => {
    const key = `${kind}:${value}`
    const owner = owners.get(key)
    if (owner) throw new Error(`${value} is shared by ${owner} and ${style} (${kind})`)
    owners.set(key, style)
  }

  styles.forEach((style) => {
    const sounds: [string, string][] = [
      ['pad', instrumentSound(findInstrument(style.pad.instrument))],
      ['figure', instrumentSound(findInstrument(style.arpSound.instrument))],
      ['bass', instrumentSound(findInstrument(style.bass.instrument))],
      ...style.solos.map((id): [string, string] => ['lead', instrumentSound(findInstrument(id))]),
    ]
    sounds.forEach(([kind, sound]) => claim(kind, sound, style.id))
    claim('drums', `${style.drums.bank ?? 'uzu'}:${style.drums.voices.map((voice) => voice.pattern).join(', ')}`, style.id)
    claim('perc', `${style.perc.bank ?? 'uzu'}:${style.perc.pattern}`, style.id)

    if (!style.solos.includes(style.solo)) throw new Error(`${style.id} opens on a lead it does not offer`)
    const palette = new Set<string>(style.palette)
    const openings = new Set<string>()
    style.sequences.forEach((sequence) => {
      claim('sequence', sequence.id, style.id)
      sequence.bars.flat().forEach((chord) => {
        if (!palette.has(chord)) throw new Error(`${style.id}: ${chord} is in ${sequence.id} but not in its palette`)
      })
      const opening = openingChord(sequence)
      if (openings.has(opening)) throw new Error(`${style.id} has two sequences opening on ${opening}`)
      openings.add(opening)
    })
  })
}
