/**
 * The four arrangements.
 *
 * Each one is a complete, closed set: its own phrases, its own chord palette, its own drum
 * machine, and its own pad, figure, bass and leads. Nothing is shared between styles, which
 * is what stops a choice inside one style from turning it into another.
 *
 * This file is data, and it is meant to read as a table. The rules that keep it honest are
 * in `validate.ts` and run at the bottom of this module, so a broken table cannot reach
 * playback.
 *
 * Drum names come from tidal-drum-machines via `.bank()`; VCSL names are used directly.
 * Each style also uses a *different* machine, so even the drum kits are exclusive.
 *
 * The bass is a real bass instrument rather than an oscillator. Soundfont bass is safe
 * here because its fixed peak lands at the same level the filtered sawtooth and square
 * basses sat at, and a picked, fingered or upright bass is worth far more musically.
 *
 * ★ The drum and percussion levels are a measured balance, not a taste. The drums used to sit
 * about twice as high as they do now, and measured on the master tap with each part soloed that
 * put the drum bus at rms 0.170 against 0.048 for the pad, 0.036 for the bass and 0.014 for the
 * chords - four to twelve times every other part, and about 89% of the whole mix's energy. The
 * drum bus also peaked at 1.43 on its own, past full scale before anything else was added.
 * Halving both the drum and percussion gains puts the bus at roughly 59% of the mix, still
 * comfortably the loudest part and no longer the whole of it. The per-layer levels in the mixer
 * are what to move if this is wrong for a particular session; these numbers are what to change
 * if it is wrong for everybody.
 */
import { DEFAULT_SOLO_RANGE } from './samples'
import { openingChord, chordRole } from './chords'
import { rhythms } from './figures'
import { type Selection, type Sequence, type SequenceId, type Style, type StyleId } from './vocabulary'
import {
  assertArrangementsAreWellFormed,
  assertChartFlows,
  assertCuesAreDistinct,
  assertLayerOrbitsAreDistinct,
  assertPadVoicingsAreOpen,
  assertEveryStyleHasAHome,
  assertFilterEnvelopesHaveCutoffs,
  assertFormsAreWellFormed,
  assertNeighboursDiffer,
  assertPatternsDivideTheBar,
  assertPhrasesDevelop,
  assertRhythmsDivideTheGrid,
  assertSectionsAreWellFormed,
  assertSectionsDiffer,
  assertStyleIsolation,
  assertTemposArePlayable,
  assertVoiceGainsAreTrims,
} from './validate'

export const styles: Style[] = [
  {
    id: 'night-drive',
    label: 'Night drive',
    description: '909 house · picked bass · clav figures · Rhodes lead',
    // Starts on the tonic, the subdominant, the flat sixth or a minor two-five.
    sequences: [
      {
        id: 'night-drive/cadence',
        label: 'Canon',
        effect: 'The canon progression in minor: tonic, dominant, flat sixth, relative major, subdominant, tonic, half-diminished two, dominant. Eight bars that turn back on themselves, over the stepwise bass that has carried so much music.',
        bars: ['i', 'V7', 'VI', 'III', 'iv', 'i', ['ii\u00f87', 'V7'], 'i'],
      },
      {
        id: 'night-drive/open',
        label: 'Marusa',
        effect: 'The Marusa progression - the city pop and neo-soul signature - answered by the Komuro progression of the same decade. Submediant, dominant with its raised seventh, tonic, relative major; then back to the submediant and down through the subdominant.',
        bars: ['VI', 'V7', 'i', 'III', 'VI', 'iv', 'V7', 'i'],
      },
      {
        id: 'night-drive/push',
        label: 'Reverse loop',
        effect: 'The reverse loop - two-five, tonic, submediant - answered by the royal-road progression, which climbs from the submediant through the flat seventh to the dominant. The first half arrives on the two-five from above and the second climbs back to the tonic, so the two halves move in opposite directions.',
        bars: ['ii\u00f87', 'V7', 'i', 'VI', 'VI', 'VII', 'V7', 'i'],
      },
      {
        id: 'night-drive/twofive',
        label: 'Komuro turn',
        effect: 'The Komuro progression turned to start on its own subdominant, so the phrase opens away from home and walks back to the tonic, then closes with the canon descent. It ends on the tonic, so the phrase turns over into itself instead of handing on a dominant with nothing to resolve it.',
        bars: ['iv', 'V7', 'i', 'VI', 'III', 'iv', 'V7', 'i'],
      },
    ],
    palette: ['i', 'i64', 'III', 'iv', 'V7', 'VI', 'VII', 'ii\u00f87'],
    // The chart. The canon states home, Marusa lifts to the flat sixth, the reverse loop drives
    // in from the two-five, and the Komuro turn walks back down to the tonic. Every one of these
    // phrases ends on the tonic, so every seam resolves, and the order is about shape rather than
    // function: settle, lift, drive, return. It is not *any* order, though - Marusa's second half
    // and the Komuro turn's first half are the same four bars entered at a different point, so
    // something has to sit between them and the reverse loop is what does. `assertNeighboursDiffer`
    // is what stops a later reorder quietly turning that into eight bars of one loop.
    form: ['night-drive/cadence', 'night-drive/open', 'night-drive/push', 'night-drive/twofive'],
    // House tempo. The four-on-the-floor kick with the clap on 2 and 4 and the open hat on the
    // offbeats is the disco row of the drum-style table, which runs 108-120; the house row runs
    // 110-184. 120 is inside both and is where a 909 sits naturally.
    tempo: 120,
    // Both voices at unity, and deliberately: the four-to-the-floor kick is what this style is, and
    // the clap and the open hat are answers to it rather than a balance to be struck with it. The
    // hats are in `perc` anyway, and quiet, which is where a house hat lives.
    drums: { voices: [{ pattern: 'bd*4' }, { pattern: '~ cp ~ cp' }], bank: 'RolandTR909', gain: 0.4, lpf: 12000, fill: ['~ ~ [~ sd] [sd sd]', '~ [~ sd] [sd sd] [sd sd]'], turn: '~ [sd sd] [ht mt] [lt cr]' },
    perc: { pattern: '[~ oh]*2, [~ hh]*4', bank: 'RolandTR909', gain: 0.17 },
    // A picked bass: the envelope opens the filter for the first fifth of a second, which
    // is the click of the plectrum, and then settles back to the body of the note.
    bass: { instrument: 'bass-pick', template: '1 ~ 1 1 ~ 1 1 ~', lpf: 800, lpenv: 1.6, lpa: 0.004, lpd: 0.16, lps: 0.18, lpq: 6, release: 0.16, gain: 0.5 },
    // The pad opens over most of a second, so a held chord brightens as it sounds instead
    // of sitting there as one static block of colour.
    pad: { instrument: 'pad-saw', lpf: 1600, lpenv: 1.5, lpa: 0.9, lpd: 0.7, lps: 0.7, lpq: 2, attack: 0.5, release: 0.7, room: 0.5, gain: 0.17 },
    // The figure is a clav, so its envelope is a pluck: open immediately, gone in a sixth.
    arpSound: { instrument: 'clavisynth', lpf: 6500, lpenv: 1.1, lpa: 0.003, lpd: 0.16, lps: 0.3, lpq: 3, attack: 0.004, release: 0.5, room: 0.4, gain: 0.8 },
    //            bars 12345678 12345678
    // The figure steps out at the halfway point, which leaves a hole the pad covers, and the
    // percussion drops for the last bar so the drums are left exposed for the turnaround. The
    // second pass swaps those two gestures, so repeating the phrase is not repeating the
    // arrangement - which is what keeps a stable form from going stale.
    arrangement: { perc: '1111111011101111', chords: '1111011111111101' },
    solos: ['rhodes', 'clean-guitar', 'flute', 'wineglass', 'kalimba'],
    solo: 'rhodes',
  },
  {
    id: 'broken-beat',
    label: 'Broken beat',
    description: 'MPC garage kit · fingered bass · FM piano figures · jazz guitar lead',
    sequences: [
      {
        id: 'broken-beat/smooth',
        label: 'Marusa loop',
        effect: 'The Marusa progression with sevenths, answered by the 1625 loop: submediant, dominant, tonic, relative major; then the tonic seventh, the submediant, the half-diminished two and the dominant. Two standard urban-garage shapes spliced.',
        bars: ['VI', 'V7', 'i', 'III', 'i7', 'VI', ['ii\u00f87', 'V7'], 'i'],
      },
      {
        id: 'broken-beat/cliche',
        label: 'Line cliche',
        effect: 'The minor line cliche: the bass walks down a semitone at a time under a held tonic, and then the tonic itself turns into the dominant of the subdominant - the fastest way to make a phrase ache. The second half resolves that dominant and closes from the subdominant.',
        bars: ['i', 'imaj7', 'i7', 'V7/iv', 'iv', 'V7/iv', 'iv7', 'i'],
      },
      {
        id: 'broken-beat/backdoor',
        label: 'Back door',
        effect: 'The back-door cadence - subdominant, flat seventh with its seventh, home - stated plainly and then left for the submediant. The second half approaches it again through the 1645 loop in sevenths and closes on the back door itself, so the phrase ends home and turns over.',
        bars: ['iv', 'VII7', 'i', 'VI', 'i7', 'VI', 'VII7', 'i'],
      },
      {
        id: 'broken-beat/lift',
        label: 'Andalusian',
        effect: 'The Andalusian fall from the flat seventh down to the dominant and home, then the 1645 loop in sevenths closing on the tonic rather than the dominant. The descent is the oldest minor sequence there is, and here it hands over to a modern urban turnaround that lands.',
        bars: ['VII7', 'VI', 'V7', 'i', 'i7', 'VI', 'iv7', 'i'],
      },
    ],
    palette: ['i', 'i7', 'imaj7', 'iv', 'iv7', 'IV', 'III', 'VI', 'VII7', 'V7', 'V7/iv', 'ii\u00f87'],
    // The chart: the line cliche states the tonic and walks down a semitone at a time, the Marusa
    // loop answers with the submediant, the back door arrives through the flat seventh, and the
    // Andalusian lift falls home. Every phrase ends on the tonic, so the whole form turns over
    // cleanly wherever it wraps.
    form: ['broken-beat/cliche', 'broken-beat/smooth', 'broken-beat/backdoor', 'broken-beat/lift'],
    // The kick is on the sixteenth grid: `bd*2 [~ bd] [bd ~] ~` is four tokens, so the bar divides
    // in four. It used to be `bd*2 [~ bd] [bd ~]` - three tokens, so the bar divided in *thirds* and
    // every kick landed between the grid lines. Against a backbeat in two that is a permanent 3:2
    // polyrhythm, which is what made this style sound incoherent rather than merely syncopated. The
    // snare was also landing on the downbeat (a bare `sd` is one token, one onset, at bar 1) and the
    // MPC snare measures 2.9x the kick, so it was both in the wrong place and the loudest thing in
    // the kit. Backbeat, off the tonic, and the kit turned down to match.
    // Broken beat and garage sit above the dance tempos rather than in them. The table's breakbeat
    // row runs 110-184 and its half-time hip-hop row starts at 132; 132 is the floor of one and the
    // middle of the other, and it is where the genre actually lives.
    tempo: 132,
    // The MPC60 snare is the loudest single voice in this repo's banks, 2.7x its own kick. On a two
    // and four that is the crack the style is named for, and also, after a few minutes, a headache:
    // the backbeat stopped being a backbeat and became the loudest thing in the arrangement. At 0.45
    // it lands about 1.2x the kick per hit - still a backbeat you feel, no longer one that hits back.
    drums: { voices: [{ pattern: 'bd*2 [~ bd] [bd ~] ~' }, { pattern: '~ sd ~ sd', gain: 0.45 }], bank: 'AkaiMPC60', gain: 0.3, lpf: 11000, fill: ['~ ~ [~ rim] [sd sd]', '~ ~ [rim sd] [sd sd]'], turn: '[rim rim] ~ [ht mt] [lt lt]' },
    perc: { pattern: '[~ hh:2]*4, ~ ~ rim ~', bank: 'AkaiMPC60', gain: 0.18 },
    // A fingered bass, so a softer envelope than the picked one: less click, more bloom.
    bass: { instrument: 'bass-finger', template: '1 ~ ~ 1 5 ~ 1 ~', lpf: 1100, lpenv: 1.5, lpa: 0.004, lpd: 0.2, lps: 0.22, lpq: 5, release: 0.22, gain: 0.46 },
    pad: { instrument: 'pad-square', lpf: 1400, lpenv: 1.3, lpa: 0.7, lpd: 0.6, lps: 0.65, lpq: 2, attack: 0.3, release: 0.6, room: 0.45, gain: 0.15 },
    // FM piano: the envelope closes quickly, so each figure note has a struck attack and a
    // short tail rather than ringing into the next one.
    arpSound: { instrument: 'fmpiano', lpf: 6500, lpenv: 1, lpa: 0.003, lpd: 0.22, lps: 0.3, lpq: 3, attack: 0.004, release: 0.5, room: 0.35, gain: 1.25 },
    //            bars 12345678 12345678
    // The percussion answers the kick rather than doubling it, so it waits for bar 2, and the
    // figure drops out for the last bar of the phrase to make room for the turnaround. On the
    // second pass the figure enters late instead, which is the same idea from the other end.
    arrangement: { perc: '0111111110111111', chords: '1111110101111111' },
    solos: ['jazz-guitar', 'dantranh', 'marimba', 'glockenspiel', 'voice-oohs'],
    solo: 'jazz-guitar',
  },
  {
    id: 'slow-bloom',
    label: 'Slow bloom',
    description: '808 kit · synth sub · psaltery figures · harp lead',
    sequences: [
      {
        id: 'slow-bloom/drift',
        label: 'Andalusian',
        effect: 'The Andalusian descent - tonic, flat seventh, flat sixth - landing on the suspended dominant, answered by the royal-road progression growing back out of the submediant through the flat seventh to that same dominant and home. The fall is repaid by a climb to the note it was falling towards. It never reaches a leading tone.',
        bars: ['i', 'VII', 'VI', 'V7sus4', 'VI', 'VII', 'V7sus4', 'i'],
      },
      {
        id: 'slow-bloom/descent',
        label: 'Descending bass',
        effect: 'The descending-bass progression turned to open on the relative major, then the subdominant, the flat seventh and the suspended dominant, so the flat seventh falls to the dominant and the dominant resolves. Every chord here is diatonic to the natural minor, so it closes without ever reaching a leading tone.',
        bars: ['III', 'i', 'VII', 'VI', 'iv', 'VII', 'V7sus4', 'i'],
      },
      {
        id: 'slow-bloom/major',
        label: 'Komuro',
        effect: 'The Komuro progression with the dominant suspended rather than given its leading tone, answered by the descending-bass progression read down through the submediant and the subdominant. The submediant opens the section and the tonic closes it, so it turns over into itself.',
        bars: ['VI', 'iv', 'V7sus4', 'i', 'VII', 'VI', 'iv', 'i'],
      },
      {
        id: 'slow-bloom/hover',
        label: 'Modal loop',
        effect: 'The minor modal loop - relative major, flat seventh, tonic, flat sixth - turned to begin on its flat seventh, answered by the Andalusian descent, which settles home on the tonic.',
        bars: ['VII', 'i', 'VI', 'III', 'i', 'VII', 'VI', 'i'],
      },
    ],
    palette: ['i', 'III', 'iv', 'VI', 'VII', 'V7sus4'],
    // The chart, and the gentlest of the five: the Andalusian descent opens on the tonic and is
    // answered back up to it, the descending bass answers from the relative major and closes from
    // the subdominant, the Komuro turn keeps the dominant suspended, and the modal loop settles
    // home. Every section ends on the tonic, so any order would resolve - this is the one that
    // reads as a shape: fall, walk down, turn, settle.
    form: ['slow-bloom/drift', 'slow-bloom/descent', 'slow-bloom/major', 'slow-bloom/hover'],
    // A downtempo style, and the table has no row for one. The nearest are the slow hip-hop feels
    // at 60-80 and the 12/8 slow blues at 50-80; 76 is inside both, and it is the tempo that makes
    // this read as a different *feel* rather than the same music with a different palette.
    tempo: 76,
    // One voice, so nothing to balance against it, and the whole kit is a whisper: this style's drum
    // bus measures an order of magnitude below every other one, which is what eighty BPM of ambient
    // wants.
    drums: { voices: [{ pattern: 'bd(1,4)' }], bank: 'RolandTR808', gain: 0.5, lpf: 7000, fill: ['~ ~ ~ [sd ~]', '~ ~ [sd ~] [sd ~]'], turn: '~ ~ [ht mt] [lt ~]' },
    perc: { pattern: 'rim(3,8), sh(5,8)', bank: 'RolandTR808', gain: 0.18 },
    // A sawtooth sub. It has to be an oscillator and not a sampled preset: a sample's attack is a
    // loop point, so it cannot be shaped, and the sound this replaces put its filter peak 400ms
    // AFTER the note started - the sample's own attack, then a separate sweep arriving late. Two
    // attacks that disagreed is what read as a very weird attack.
    //
    // Four decisions, in the order the skill asks for them: it is pitched, so the waveform is a saw
    // (a built-in shape, nothing fetched, rich in harmonics); the register is the template's, one
    // root a bar, so it is the low one by construction; the amplitude envelope is a short attack
    // for a defined onset with full sustain so the note holds the bar and a release long enough to
    // ring into the next chord; and it is bright enough to survive a phone speaker, where 1100Hz
    // over a saw keeps about seventeen harmonics of the root.
    //
    // The sweep moved to the filter DECAY. `lpa` is 8ms, so the peak lands with the note instead of
    // lagging it, and `lpd` is 1.6s, so the note arrives with definition and blooms into weight.
    // `lpq` is what makes the movement audible as movement rather than a change of colour.
    //
    // `template: '1'` is ONE token, so the root lasts the whole bar - the same shape the pad uses,
    // and the reason the pad sustains and this did not. It was `'1 ~ ~ ~ ~ ~ ~ ~'`, which is eight
    // tokens, so the note was an EIGHTH: at 76 BPM it stopped 0.395s in, exactly the "and" of count
    // 1, and the release took over from there. That is the shape change that is audible at the and
    // of 1. The sampled preset this replaced covered the hole by ringing on past it; an oscillator
    // obeys the note's length, so for this sound the note has to be the bar.
    //
    // `release` is 60ms for the same reason, one level down. A release has to either finish under
    // the next note's attack, where that attack masks it, or fade out slowly enough that its ending
    // is never a moment. The 0.4s it was before did neither: the tail of one root was still ringing
    // when the next arrived - a whole-step or minor-second pair in the bass - and then stopped on
    // the "and" of 1, which is a second shape change in the same place. At 60ms the tail is gone by
    // the time the new note has begun and its ending is masked by the attack that follows it.
    // Softened, and given the detune. The harshness was `lpq: 4`: a resonance sitting on a cutoff
    // that sweeps up to 2.9kHz emphasises exactly the harmonics that make a saw sound hard, and a
    // 12ms attack left the edge of it bare. Filtering is what fixes that and waveshaping is not -
    // waveshaping *adds* harmonics, so it would make this worse; it is the answer when a bass is
    // too dark to be heard at all, not when it is too bright. So: resonance down to a whisper, the
    // sweep peak down to about 2kHz, the filter opening over 50ms rather than 8ms so the brightness
    // arrives with the note instead of snapping at it, and a 25ms amplitude attack.
    //
    // The sound is `supersaw` now, and that IS the chorus: one worklet, five detuned voices spread
    // nine cents either side of the root and panned 0.6 apart, and it divides its own output by the
    // square root of the voice count, so the extra thickness does not arrive as extra level.
    // Strudel's own `.chorus()` is *not* implemented in superdough - it would be a silent no-op
    // here - so this is the detune that actually exists.
    // `detune` is the supersaw's own spread, in semitones from the lowest voice to the highest:
    // 0.18 is its default and puts the five voices at +/-9 cents, so 0.09 is +/-4.5 and about
    // half the movement. The bass is the one place a wide spread wears thin - it is a single root
    // held for a whole bar, and the beating is the only thing moving, so it is heard more than it
    // would be on a chord.
    bass: { instrument: 'bass-synth', template: '1', detune: 0.09, lpf: 1100, lpenv: 0.9, lpa: 0.05, lpd: 1.6, lps: 0.35, lpq: 1, attack: 0.025, release: 0.06, gain: 0.24 },
    // The whole point of this style is the pad, so its envelope is the longest here: two
    // octaves of opening over a second, matching the pad's own slow amplitude attack.
    pad: { instrument: 'pad-triangle', lpf: 900, lpenv: 2, lpa: 1, lpd: 1.4, lps: 0.8, lpq: 2, attack: 1.2, release: 1.2, room: 0.7, gain: 0.16 },
    // `gain` is doing two jobs here: it is the figure's accent, and it is the level matching the
    // sample needs. `psaltery_pluck` is a soft zither recording and plays an order of magnitude
    // below a synth at the same gain - measured, the figure peaked at 0.017 against the pad's 0.189
    // while the gain pattern (0.31 on a beat, 0.19 off it) was already HIGHER than the pad's 0.2.
    // So this is 2.0 rather than a taste trim: at 0.34 the layer is inaudible under a sustained pad,
    // which masks short plucks far more than it masks another pad. Watch for this on any figure or
    // lead that is a quiet sample rather than a synth - the gains are not comparable across them.
    arpSound: { instrument: 'psaltery', lpf: 4500, lpenv: 1.4, lpa: 0.004, lpd: 0.3, lps: 0.3, lpq: 3, attack: 0.01, release: 1, room: 0.55, gain: 2.6 },
    //            bars 12345678 12345678
    // The figure states the harmony at each end of the phrase and hands the middle to the pad, and
    // the percussion arrives halfway. Its gaps are kept to two bars, though, where they used to run
    // to four: four bars of silence is 12 seconds at this tempo, and with a three-event rhythm on top
    // the chords were inaudible for most of the form however loud the layer was. The percussion still
    // stays later on the second pass, so the form moves underneath a held pad.
    arrangement: { perc: '0000111100111111', chords: '1101001111100111' },
    solos: ['harp', 'vibraphone', 'tubularbells', 'handchimes', 'ocarina'],
    solo: 'harp',
  },
  {
    id: 'after-hours',
    label: 'After-hours jazz',
    description: 'R-8 brushed kit · upright bass · balafon comping · piano lead',
    sequences: [
      {
        id: 'after-hours/twofive',
        label: 'Minor two-five',
        effect: 'The reverse loop - two-five, tonic, submediant - answered by the Komuro progression, which carries that submediant down through the subdominant to the dominant and home. The oldest cadence in jazz, and then the turn of the decade it came from.',
        bars: ['ii\u00f87', 'V7', 'i', 'VI', 'VI', 'iv', 'V7', 'i'],
      },
      {
        id: 'after-hours/standard',
        label: 'Turnaround',
        effect: 'The standard turnaround - tonic, submediant, half-diminished two, dominant - answered by a close that keeps the promise that dominant made: the tonic again, the subdominant, the dominant and home. The first half opens and the second half closes, which is what makes eight bars a phrase rather than a four-bar loop stated twice.',
        bars: ['i', 'VI', 'ii\u00f87', 'V7', 'i', 'iv', 'V7', 'i'],
      },
      {
        id: 'after-hours/dark',
        label: 'Neapolitan',
        effect: 'The Neapolitan cadence: the subdominant, the Neapolitan in first inversion so its bass holds while the flat sixth falls to the dominant, then home. The second half is the Andalusian descent, which walks the tonic down through the flat seventh and the flat sixth and stops on the dominant - so the form turns over on a dominant, straight back to the top.',
        bars: ['iv', 'bII', 'V7', 'i', 'i', 'VII', 'VI', 'V7'],
      },
      {
        id: 'after-hours/descent',
        label: 'Andalusian fall',
        effect: 'The Andalusian fall from the flat seventh down to the dominant and home, answered by the royal-road progression, which climbs from the submediant through the flat seventh to the dominant. The first half descends, the second climbs, and both close on the tonic.',
        bars: ['VII', 'VI', 'V7', 'i', 'VI', 'VII', 'V7', 'i'],
      },
    ],
    palette: ['i', 'ii\u00f87', 'iv', 'V7', 'VI', 'VII', 'bII'],
    // The chart: the standard turnaround opens on the tonic, the Andalusian fall descends from the
    // flat seventh, the minor two-five states the oldest cadence in jazz, and the Neapolitan closes
    // from a semitone above the tonic.
    //
    // The order is not free, and the last section is the first reason. The Neapolitan ends on a
    // dominant with nowhere to go but home, and home is where the form starts - so the form turns
    // over on the dominant, which is what a turnaround is for and what the drum cue on the last bar
    // is marking. The three other sections end on the tonic, so those seams would take any order;
    // the second reason is that the standard turnaround's first half and the minor two-five's first
    // half are the same four bars entered at a different point, so they must not become neighbours.
    form: ['after-hours/standard', 'after-hours/descent', 'after-hours/twofive', 'after-hours/dark'],
    // A medium jazz tempo. The small-band row runs 60-304, so almost anything is "in range" and
    // the range is not the constraint - the brushes are: the brush patterns only work above about
    // 88, and below that the kit wants to be a ballad. 96 is the slow side of a working medium.
    tempo: 96,
    // The ride at five to the bar was 97% of this style's drum bus and 4.5x the kick: the time, but
    // so far above everything else that it was not the time any more, it was the kit. At 0.35 it
    // sits about 1.6x the kick, which is a jazz ride's job - leading the kit without being it.
    drums: { voices: [{ pattern: 'bd(1,4)' }, { pattern: 'rd(5,8)', gain: 0.35 }], bank: 'RolandR8', gain: 0.28, lpf: 9000, fill: ['~ ~ [~ rim] [sd ~]', '~ ~ [rim sd] [sd ~]'], turn: '~ [sd sd] [mt lt] [rim ~]' },
    perc: { pattern: 'rim(3,8)', bank: 'RolandR8', gain: 0.2 },
    // An upright has no plectrum and no pickup, so the envelope barely opens: enough to
    // shape the note, not enough to sound electric.
    bass: { instrument: 'bass-upright', template: '1 ~ 3 ~ 5 ~ 8 ~', lpf: 1600, lpenv: 1.3, lpa: 0.02, lpd: 0.35, lps: 0.3, lpq: 2, release: 0.35, gain: 0.5 },
    // A quiet organ that opens slowly. Being a sample rather than an oscillator is the one
    // thing this style does differently to the others, and the envelope shapes it the same way.
    // The only pad here that is a SAMPLE rather than an oscillator, and it is a quiet one. Measured
    // against its own drum bus it peaked at 0.015 where every other style's pad peaks at 0.15-0.25,
    // so the bed the style sits on was effectively absent and the figure read as four times louder
    // than the pad. `pipeorgan_quiet` is quiet by name and by measurement; a synth at this setting
    // would be far too loud. The gain is level matching, exactly as the figures need.
    pad: { instrument: 'pipeorgan_quiet', lpf: 1200, lpenv: 1.4, lpa: 1, lpd: 1, lps: 0.75, lpq: 2, attack: 1, release: 1, room: 0.45, gain: 1.6 },
    arpSound: { instrument: 'balafon', lpf: 5000, lpenv: 1.2, lpa: 0.003, lpd: 0.25, lps: 0.25, lpq: 3, attack: 0.004, release: 0.45, room: 0.4, gain: 0.75 },
    //            bars 12345678 12345678
    // The comping drops for bar 4, so the phrase turns on the bass and the pad alone; the
    // brushes stop for the last two bars and leave the kit to play the ending by itself. The
    // second pass sits out longer at the end, which is a jam settling rather than a form
    // running down.
    arrangement: { perc: '1111110011110000', chords: '1110111110111111' },
    solos: ['piano', 'sax', 'muted-trumpet', 'clarinet', 'strumstick'],
    solo: 'piano',
  },
  {
    id: 'blues',
    label: 'Straight blues',
    description: 'LinnDrum kit · saw synth bass · additive reed comping · harmonica and guitar lead',
    // The blues, in minor, on a straight eighth grid rather than a shuffle: the whole app runs
    // on one sixteenth grid and refuses a figure that does not divide it (see validate.ts), so
    // this is the blues-rock reading of the form rather than a 12/8 one.
    //
    // The blues is the one style here whose section is not eight bars. A chorus is twelve, and
    // Each opens on a different degree so Jev always has a real choice. The tonic is the plain
    // triad because the vocabulary's `i7` puts the flat seventh in the bass, which would move
    // the home note a whole step down; the tonic-turned-dominant is `V7/iv` instead, which is
    // the blues I7 and does keep the root where it belongs - and it is the *only* chord in the
    // vocabulary with a raised third over a tonic root, so it is also the only one that can put
    // the major third against the key's minor third. In a minor key the flat third and flat
    // seventh are diatonic, so that rub is the one blue note the harmony can still carry.
    sequences: [
      {
        id: 'blues/twelve',
        label: 'Twelve-bar blues',
        effect: 'The plain chorus, twelve bars as it is counted: four of the tonic, the subdominant answering in the fifth and sixth, the tonic again, then the dominant, the subdominant and home. Every other chorus here is this one with something changed.',
        bars: ['i', 'i', 'i', 'i', 'iv7', 'iv7', 'i', 'i', 'V7', 'iv7', 'i', 'i'],
      },
      {
        id: 'blues/chromatic',
        label: 'Chromatic blues',
        effect: 'The chorus opened from the subdominant, so the tonic arrives as the answer rather than the question - and it comes home the long way the second time: the flat sixth, then the Neapolitan a semitone above the tonic, then the dominant. Two chromatic steps into the same place.',
        bars: ['iv7', 'iv7', 'i', 'i', 'iv7', 'iv7', 'i', 'i', 'VI', 'bII', 'V7', 'i'],
      },
      {
        id: 'blues/quick',
        label: 'Quick change',
        effect: 'The quick change: the tonic turned into its own dominant, so the subdominant arrives in the second bar as a resolution rather than as a move. It is the one chorus here that ends on a dominant, so it is the one that turns over - which is what makes it the right one to play last.',
        bars: ['V7/iv', 'iv7', 'V7/iv', 'V7/iv', 'iv7', 'iv7', 'V7/iv', 'V7/iv', 'V7', 'iv7', 'V7/iv', 'V7'],
      },
    ],
    palette: ['i', 'iv7', 'V7', 'V7/iv', 'VI', 'bII'],
    // LinnDrum: the machine blues-rock reached for when it wanted to sound modern rather than
    // vintage, which is the same instinct that put a synth bass under these phrases.
    // The chart: three choruses, thirty-six bars, which is what a blues set actually is. The plain
    // chorus first, so the form opens and closes at home and the style can be entered gracefully;
    // then the chromatic one; then the quick change, which is the only chorus that ends on a
    // dominant and so hands straight back to the plain one. Every seam resolves and the form turns
    // over wherever it wraps.
    form: ['blues/twelve', 'blues/chromatic', 'blues/quick'],
    // A blues shuffle runs 80-160. This style is the straight-eighth reading of the form, which is
    // the reading that arrived with rock, and it sits mid-range: fast enough that the two-beat kick
    // rolls, slow enough to leave the choruses room.
    tempo: 112,
    // Eight straight eighths against two kicks and two snares made the hi-hat 83% of this style's
    // drum bus: the classic way a timekeeper wins by counting rather than by playing, because eight
    // onsets beat two whatever the per-hit level. At 0.4 it lands about level with the kick - audible
    // as time, no longer carrying the kit.
    drums: { voices: [{ pattern: 'bd sd bd sd' }, { pattern: 'hh*8', gain: 0.4 }], bank: 'LinnDrum', gain: 0.36, lpf: 10000, fill: ['~ ~ ~ [sd sd]', '~ ~ [sd ~] [sd sd]'], turn: '~ [sd sd] [ht mt] [lt cr]' },
    perc: { pattern: '[~ cb]*2, [~ sh]*4', bank: 'LinnDrum', gain: 0.15 },
    // A bright synth bass with a filter that cracks open on every note: the one place this
    // style leaves the blues behind and leans on the synth.
    bass: { instrument: 'bass-synth-2', template: '1 ~ 1 3 1 ~ 5 ~', lpf: 900, lpenv: 1.8, lpa: 0.004, lpd: 0.18, lps: 0.2, lpq: 5, release: 0.3, gain: 0.3 },
    // A reed-like bed that opens slowly, so a held blues chord breathes rather than sits.
    pad: { instrument: 'pad-reed', lpf: 1200, lpenv: 1.2, lpa: 1.1, lpd: 0.9, lps: 0.7, lpq: 2, attack: 0.6, release: 0.9, room: 0.45, gain: 0.16 },
    // A dry, hollow comp, short enough to stay out of the harmonica's way.
    arpSound: { instrument: 'pluck-glass', lpf: 4000, lpenv: 1.3, lpa: 0.003, lpd: 0.2, lps: 0.25, lpq: 3, attack: 0.004, release: 0.35, room: 0.35, gain: 0.41 },
    //            bars 123456789012 123456789012 123456789012
    // A chorus is twelve bars, so the mask is a chorus long and repeats with the form: the
    // percussion waits for the second bar so each chorus opens on the kit alone, and the comping
    // steps out of the twelfth to leave the last bar to the band - which is exactly where the
    // section fill lands, so the cue and the arrangement say the same thing in two voices.
    arrangement: { perc: '011111111110', chords: '111111111110' },
    solos: ['harmonica', 'overdriven-guitar', 'muted-guitar', 'guitar-harmonics', 'saw-lead'],
    solo: 'harmonica',
  },
]

export function findStyle(id: StyleId): Style {
  return styles.find((style) => style.id === id) ?? styles[0]
}

/** The sequence id within `styleId`'s own set, falling back to its first. */
export function findSequence(styleId: StyleId, id: SequenceId): Sequence {
  const style = findStyle(styleId)
  return style.sequences.find((sequence) => sequence.id === id) ?? style.sequences[0]
}

/**
 * The phrase a session opens on, and the one a style change lands on: the phrase that opens on
 * the tonic.
 *
 * A jam starts at home. Whatever form gets called, everybody's first chord is the chord that
 * says where the key is, because that is what the rest of the form is heard against. Landing a
 * player on a phrase that opens somewhere else means they hear bars of music before they know
 * what key they are in - and if the phrase opens on the half-diminished two, the first two bars
 * are a chord with nothing to resolve to, which is the most disorienting thing a form can do to
 * somebody who has just walked in.
 *
 * So each style has exactly one phrase opening on the tonic (`assertEveryStyleHasAHome` enforces
 * it) and this is how it is found. The phrases that open elsewhere are worth having - they are
 * the departures - but you should always be able to hear what they are departing *from*.
 */
export function homeSequence(style: Style): Sequence {
  return style.sequences.find((sequence) => chordRole(openingChord(sequence)) === 'tonic') ?? style.sequences[0]
}

/**
 * The sections of a style's chart, in the order they will be played, beginning at `leader`.
 *
 * The form is a cycle, so leading from a different phrase is a rotation of it and nothing else:
 * the same music in the same relative order, entered at a different point. That is what makes a
 * change cheap and safe - whatever Jev or the player picks, the chart that follows is one of the
 * style's own forms, and every seam in it has already been checked at import.
 */
export function chartSections(style: Style, leader: SequenceId): Sequence[] {
  const at = style.form.indexOf(leader)
  const from = at === -1 ? 0 : at
  return [...style.form.slice(from), ...style.form.slice(0, from)].map((id) => findSequence(style.id, id))
}

/**
 * The bar counts of a chart's sections, in the order they are played.
 *
 * A section is as long as its own music, so the things that used to be one number - how far the
 * panel steps to the next section, where the section cue lands, how much notice the player gets -
 * are all answered from this list instead.
 */
export function sectionBars(sections: Sequence[]): number[] {
  return sections.map((section) => section.bars.length)
}

/** The number of bars the style's chart runs for. */
export function chartBars(style: Style): number {
  return chartSections(style, style.form[0]).reduce((total, section) => total + section.bars.length, 0)
}

/**
 * The selection the app opens with. It names one of the arrangements above, so it lives
 * here rather than with the vocabulary.
 */
export const defaultSelection: Selection = {
  key: 'C minor',
  style: 'night-drive',
  sequence: homeSequence(findStyle('night-drive')).id,
  chordMode: 'combo',
  arp: 'broken',
  rhythm: 'pulse',
  solo: 'rhodes',
  soloLow: DEFAULT_SOLO_RANGE.low,
  soloHigh: DEFAULT_SOLO_RANGE.high,
  tempo: findStyle('night-drive').tempo,
}

// The catalogue checks itself as it loads. `validate.ts` says what each rule is for.
assertRhythmsDivideTheGrid(rhythms, 16)
assertSectionsAreWellFormed(styles)
assertPhrasesDevelop(styles)
assertSectionsDiffer(styles)
assertNeighboursDiffer(styles)
assertFormsAreWellFormed(styles)
assertChartFlows(styles)
assertPatternsDivideTheBar(styles)
assertCuesAreDistinct(styles)
assertLayerOrbitsAreDistinct()
assertPadVoicingsAreOpen(styles)
assertTemposArePlayable(styles)
assertVoiceGainsAreTrims(styles)
assertEveryStyleHasAHome(styles)
assertFilterEnvelopesHaveCutoffs(styles)
assertArrangementsAreWellFormed(styles)
assertStyleIsolation(styles)
