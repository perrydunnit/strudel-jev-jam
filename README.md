# Jev / Strudel Jam Partner

A private local prototype for an AI jamming partner. Strudel owns browser audio and layered synth sound design, Web MIDI supplies musical snapshots, and TypeSafe's Jev chooses the harmonic direction and rhythmic feel.

## Current State

Working end to end:

- React + TypeScript + Vite app shell.
- Each style is a full arrangement built from real samples: a drum pattern from a classic drum machine, a bass line, and a chord layer that can be pads, an arpeggiated figure, or both.
- Music moves in **sequences**: four phrases per style, every one of them eight bars. Jev decides at the end of each one whether to repeat it or move on, using your MIDI activity and the recent sequence history. A sequence is never swapped mid-bar, and a change is never heard late: see *Sequences* below.
- A **mixer** in the layer list: every part has a mute and a solo button, and silencing one is a gain change on that part's own bus, so it takes effect on the note already ringing and leaves the phrase running.
- Every phrase has a **shape**. The percussion and the chord figure enter and leave on their own bar schedule, so the arrangement breathes instead of running all five layers from bar 1 to bar 8; the drums, bass and pad never drop out. See *The phrase has a shape* below.
- Nothing sits exactly on the grid. The bass, pad and chord figure have **moving filters**, and the drums, percussion, bass and figure vary their timing and their level hit to hit. See *Nothing sits exactly on the grid* below.
- Jev can be **switched off** entirely. With it off nothing is sent, the phrase repeats, and only your own choices move the music.
- Solo instruments are 25 colours - acoustic, electric, cosmic, plucked, mallet and wind - each pitched, so notes play in tune. Five of them are guitars, which exist nowhere in the CDN sample maps and therefore come from the General MIDI soundfonts.
- Choices are visible and playable in the UI: style, key, tempo, sequence, chord mode (pads / arpeggio / combo), 5 arpeggio figures, 4 rhythm patterns and 25 solo instruments. `Key` transposes with correct accidentals and `Tempo` drives the Strudel clock.
- A "What is playing right now" panel shows one line per voice - the program is written as a `const` per layer and a final `stack` - and each voice carries its own Strudel view: an event grid for the drums, a piano roll for the bass, a spectrum for the pad, a pitch wheel for the chord figure and an oscilloscope for the live keys.
- Real Web MIDI: `requestMIDIAccess`, device list, hot-plug rescan, note-on/off (including velocity-0 note-off), sustain pedal, and the live notes/pedal state surfaced in the UI.
- MIDI notes sound through Strudel's audio engine: each key press starts a note with the selected instrument's key voice (velocity mapped to gain), and each key release fades it out, so note length follows the key.
- A "Play my keys" switch and an *Audition* button let you verify the routing without touching the keyboard.
- A local Jev proxy sends structured state to `TypeSafeClient.systemOne` and asks two `choice` questions (harmony + rhythm). Jev is asked **once per sequence**, one bar before it ends, and the answer is applied on the wrap.
- Both answers keep their own confidence and their full probability distribution, so the UI can show what was weighed instead of collapsing it into one number.
- Every response is validated against the local allowlists, so an unknown id or a broken response can never reach the audio engine.

## Run Locally

Requirements: Node.js 20 or newer, a browser with Web Audio support, and a secure context for Web MIDI (`localhost` is sufficient for local development).

```sh
npm install
npm run dev:server
npm run dev
```

Open the Vite URL shown in the terminal. Use the Start button to authorize audio and begin a session. The Jev proxy listens on `http://localhost:8787` and Vite forwards `/api` requests to it.

Create `.env` from `.env.example` and set `TYPESAFE_API_KEY` for real Jev decisions. Never put this key in client-side Vite variables or commit it. If a key has been exposed, rotate it before continuing.

Useful checks:

```sh
npm run build
npm run lint
npx tsc --noEmit --ignoreConfig --module esnext --moduleResolution bundler --target ES2023 --types node server/jevProxy.ts
```

## Sound Engine

Sounds are drawn from samples, soundfonts and a few oscillators, not synthesised from scratch: the app registers the same sample maps the strudel.cc REPL loads by default, straight from its CDN (`strudel.b-cdn.net`), so it gets the same instrument and drum-machine libraries. The only oscillators are the pads, for the reason given under *Instruments* - a pad must never be the layer that is missing.

| Pack | Contents |
|------|----------|
| `uzu-drumkit` | plain kit names with variations: `bd sd hh oh cp rim rd ht mt lt cb misc` |
| `tidal-drum-machines` | 683 samples across 71 classic machines, addressed with `.bank()` (TR909, TR808, MPC60, LinnDrum, DMX, ...) |
| `piano` | multi-sampled concert grand, keyed per pitch |
| `vcsl` | 128 orchestral and mallet instruments: `steinway`, `kawai`, `harp`, `marimba`, `vibraphone`, organs, winds, percussion |

Maps are fetched at startup (a few KB each, CORS-enabled); the audio files load lazily the first time a sound is played. A pack that fails to load is not fatal - the affected layers fall back to synths and the UI reports it.

Each style defines its own `drums` (pattern + bank), `perc`, `bass` (template + voice), `pad`, `arpSound` and default `solo` instrument. Bass templates use degree tokens - `1` root, `3` third, `5` fifth, `8` root an octave up, `~` rest - so a bass line follows the chord under it. Every name in those tables is checked against the loaded maps, so a typo cannot silently produce a missing layer.

### Sequences

Each style owns its own four phrases, and every phrase is eight bars. Nothing is shared between
styles, and the length is enforced at import: a phrase that is not eight bars throws, because
the handoff below is built from two phrases and the halfway point is where a phrase turns, so a
set that mixed four and eight bar phrases would make both meaningless.

Eight bars is not four bars twice. The existing four bars became the **antecedent** and each
phrase gained its own **consequent**, so the second half answers the first instead of repeating
it: the cadence stated again from a different approach, the same descent carried one step
further, the turnaround restated with the subdominant in place of the flat sixth. Where a phrase
landed on the tonic at bar 4 it now reopens there and closes harder at bar 8; where it landed on
the dominant it is answered by the cadence it was asking for. Each phrase's `effect` says what
the whole eight bars do, because that text is also the description Jev judges the option by.
They are written in a minor key from a chord vocabulary of seventeen chords: the natural minor
triads, the harmonic minor dominant (`V`, `V7`), the relative major, seventh chords, the
half-diminished two, a secondary dominant (`V7/iv`), the Neapolitan (`bII`, and in first
inversion: in root position its bass leaps to the flat second, which throws away the voice
leading that is the only reason to reach for the chord), a suspended
dominant, and two inverted voicings. Each style also declares a **palette** - the chords it is
allowed to use - and the startup check fails if a phrase reaches outside it.

Every phrase comes from `mc-progressions`, the local lookup library, rather than being invented.
That library lists eight named progressions precisely so no one has to reinvent them, and its §4
supplies the move that made this work: **splice two four-bar patterns rather than invent an
eight-bar one.** Each phrase below is a named progression, or two of them spliced, transposed to
minor and stated at one chord per bar (a two-chord bar where the two-five wants to be in one).

| Phrase | Named progression | As played |
|---|---|---|
| Canon | カノン進行 - `I V VIm IIIm IV I IIm V` | `i V7 VI III iv i [iiø7 V7] i` |
| Marusa | 丸サ進行 (4361) spliced with 小室進行 (6451) | `VI V7 i III / VI iv V7 i` |
| Reverse loop | 逆循環 (2516) spliced with the canon's second half | `iiø7 V7 i VI / iv i [iiø7 V7] i` |
| Komuro turn | 6451, turned to begin on its own subdominant, then the canon | `iv V7 i VI / i V7 VI III` |

The other four styles draw on the same library. Broken beat runs the Marusa progression with
sevenths and the 1645 loop, the minor line cliche, the back-door cadence, and the Andalusian
fall. Slow bloom takes the Andalusian descent and the descending-bass progression with the
dominant replaced by a suspended one - the library's own suggestion for a more refined sound -
and uses no leading tone anywhere. After-hours takes the standard turnaround, the royal-road
progression, the minor two-five, the Neapolitan cadence and the Andalusian fall, and the form it
builds from them ends on a dominant - see below. The blues takes the twelve-bar form itself, and
plays it as twelve bars rather than cutting it to fit.

This replaced two separate mistakes. The first version was *invented*, assembled from generic
functional moves - a descent to the dominant, a cadence landing home - which is precisely what
the lookup library exists to prevent. And invented or not, nine of the sixteen phrases repeated
three of their four bars between the halves: they were four-bar loops played twice, which the ear
hears at once even when the notation looks like eight bars. "Thirteen of the sixteen now share
nothing or one bar between the halves" was true and not enough, and that is worth recording,
because the ear found the one it missed before the code did.

#### The audit, and the two rules it produced

The same analysis was then run over all twenty sequences - halves side by side, positional repeats,
a rotation of the first half, a dominant at the midpoint that fails to resolve to the tonic, the
section seams, and every four-bar half compared against every other in the same style. Two faults
surfaced that nothing had been checking for, and each is now a rule.

`assertSectionsDiffer` refuses a style in which two halves of the form are the same four bars. The
per-phrase rule cannot see this, because it only ever looks inside one phrase. Night-drive had two
sections sharing the canon's closing half, and three of the four blues sections - which were then
eight bars each - shared `iv7 i V7 i`, so the blues was one section plus three variations on its
own back half. Rewriting the blues as three genuine twelve-bar choruses removed the other two.

`assertPatternsDivideTheBar` refuses a drum or percussion voice whose top-level token count is not
a power of two. broken-beat's kick was `bd*2 [~ bd] [bd ~]` - **three tokens, so the bar divided
into thirds** - against a snare and a hi-hat in two. A permanent 3:2 polyrhythm does not sound
syncopated, it sounds incoherent, and it was not the drum *sounds* that were wrong. The same voice
also had a bare `sd`, which is one token and therefore one onset **on the downbeat**, fighting the
kick. Measured onsets before: `0, 1/6, 1/2, 2/3`. After: `0, 2/16, 4/16, 6/16, 8/16, 12/16` -
every one on a sixteenth, with the snare on beats 2 and 4 where a backbeat belongs.

The volume complaint was real too, and separable. At equal gain the MPC60 snare measures **2.9x the
kick** (rms 0.293 against 0.1024), so a snare on the downbeat was the loudest thing in the kit. With
the pattern fixed and the kit turned down, broken-beat's drum bus went from 0.1736 rms and 1.27 peak
to 0.1358 and 0.79 - the same range as the other four.

Auditing also turned up one genuine harmonic fault: `broken-beat/cliche` used `V7` (G7, the dominant
of the *tonic*) at bar 4 to push into `iv` (Fm). The move to the subdominant wants the dominant *of
the subdominant*; it is `V7/iv` (C7) now, which is what the phrase's own second half was already
using. The rest of the flags were false positives of the midpoint rule - a step or a modal move
between two four-bar units is ordinary music - and the audit is a diagnostic, not an assertion.

A note on method, because it cost real time: **`tsc` does not execute the module.** Every
import-time assertion in `validate.ts` is skipped by a typecheck, so "the build is clean" says
nothing about whether the invariants hold. They need something that imports the tables -
`npx tsx -e "import { styles } from './src/domain/styles.ts'"`, or `scripts/verify-handoff.ts`, or
the app itself.

#### The check that was half a check

`assertPhrasesDevelop` compares a phrase's two halves **position by position** and refuses more
than two matches, so a phrase that is secretly a four-bar loop cannot reach playback. That misses
one case, and the after-hours turnaround was it:

```
half 1:  i    VI    iiø7   V7
half 2:  iiø7 V7    i      VI
```

Rotate half 1 left by two and you get half 2 exactly. It is the same four-bar loop stated twice,
entered from a different point - and it shares **zero** bars with itself position by position, so
the check passed it. What it sounds like is what a jammer notices: four bars where nothing new
happens, and a dominant at bar 4 that promises the tonic and resolves to the subdominant instead.
The rule now also compares the halves as cycles and rejects a rotation, which is the same fault in
a disguise. It rejects exactly one phrase in the catalogue - that one.

The fix followed from the diagnosis. A turnaround ends on a dominant, and a dominant wants the
tonic, so whatever follows bar 4 has to *be* the tonic: the phrase became an antecedent that opens
and a consequent that closes. Looking at the whole form then turned up a second fault in the same
style - its four sections were built from six four-bar units, so two units played twice and two
pairs of sections were near-duplicates of each other. Every one of the eight halves now states its
own unit, and the last section ends on a dominant with nowhere to go but home, which is where the
form starts. Verified in the page: eight distinct halves, no duplicates, and the form's last bar
is `G7` resolving to `Cm` at bar 1 - so the drum cue on bar 32 is marking a real turnaround rather
than an arbitrary full stop.

The library also carries a warning list, and it is worth being honest about it: `1564`, `6415`,
`1645` and `4536` are what generative models reach for by default, and `4536` is the Canon's own
family. The test the library offers is whether a progression was *chosen* or *defaulted into*.
One phrase here uses a listed progression in its minor reading and turned to begin on a different
chord, which is that library's first countermeasure.

The opposite fault was there too: several phrases never touched the tonic at all, so they
drifted instead of closing. Where a phrase ends on the dominant now it is deliberate - it drives
into whatever follows, and it is a real signal to Jev, whose candidates are ranked by how well
their opening chord follows the chord the phrase ended on.

Broken beat runs on seventh chords and secondary dominants, slow bloom never uses a leading
tone, and after-hours has the Neapolitan and the Andalusian fall. The devices were chosen from
the local `mc-harmony` and `mc-progressions` skills, which supply the cadence types, the rule
that a minor key's dominant must come from the harmonic minor, and the list of progressions
generative models reach for by default - those four (`1564`, `6415`, `1645`, `4536`) are
deliberately not used as-is. Hooktheory's popular-progression data pointed the same way: its
intermediate and advanced tiers are almost entirely inversions, secondary dominants and
borrowed chords.

### The blues, and three places it bends

The blues is a form rather than a progression, so its sections are readings of the same twelve
bars: the plain chorus (`i i i i iv7 iv7 i i V7 iv7 i i`), a chromatic reading that opens on the
subdominant and comes home from the flat sixth and the Neapolitan
(`iv7 iv7 i i iv7 iv7 i i VI bII V7 i`), and the quick change, with the tonic turned into its own
dominant so the subdominant arrives in the second bar as a resolution rather than as a move
(`V7/iv iv7 V7/iv V7/iv iv7 iv7 V7/iv V7/iv V7 iv7 V7/iv V7`). Each opens on a different degree, as
every style's sections do, and they are twelve bars each rather than eight: a chorus is twelve, and
cutting one down to fit a shared length was the compromise the old `PHRASE_BARS` constant forced on
this style and no other.

Three things about it are worth stating rather than leaving to be discovered:

- **It is in minor, because the key vocabulary is.** `KEYS` holds C, D, F and A minor and nothing
  else, so there is no major blues in this catalogue. This is the minor blues - the form as played
  by anyone reaching for the flat third, which is most of it.
- **It is straight, not a shuffle.** A shuffle means triplets, the whole app runs on one sixteenth
  grid, and `assertRhythmsDivideTheGrid` refuses a figure that does not divide it - a rule that
  exists because a triplet figure against straight drums was a real bug here once, not a
  theoretical one. So this is the blues-rock reading of the form, eighth notes rather than a
  twelve-eight lilt, and it is the one place the style is not the idiom it is named for.
- **The tonic is the plain triad, not `i7`.** The vocabulary's `i7` puts the flat seventh in the
  bass, which is a fine voicing on a passing chord and the wrong one on a tonic: it moves the home
  note a whole step down, mid-phrase. The blues I7 is `V7/iv` instead - the same four notes with
  the root where it belongs - and that is what the quick change opens on.

A bar holds one chord, or two when the harmony should move twice as fast. A phrase is one
Strudel slowcat, one cycle per bar, so it loops without anything being rebuilt:

```js
// bar 3 moves twice, so its two chords nest one group each inside the bar
note("<[c3,eb3,g3] [f3,ab3,c4] [[c3,eb3,g3] [g3,b3,d4,f4]] [c3,eb3,g3]>")
```

A chord carries its own `bass` when the lowest voice is not the root, which is what makes the
inversions and the line cliché work: the pad plays the chord while the bass plays the note
underneath it. Where a bar holds two chords, each one takes half the bar and gets the opening
of the bass figure, so the new root still lands on the beat.

Chords are written as semitone offsets from the tonic, so a phrase transposes by changing
the key alone. The spelling tables are indexed by absolute pitch class and tuned per key, so
the transposed accidentals come out right: the dominant's raised seventh is B natural in C
minor, C sharp in D minor, E natural in F minor and G sharp in A minor.

Because the phrase lives inside the pattern, it loops without anything being rebuilt. The app reads `getTime()` - Strudel's own scheduler position in cycles - to know which bar is playing, so the bar strip in the UI is truthful and Jev's answer is applied on the bar line rather than on a wall-clock guess. Jev is asked **halfway through the phrase**, which is half a phrase of notice rather than the one bar it used to be.

#### The form holds, and the playing varies

This is the part that had to be learned rather than designed, and it is worth stating plainly
because the code used to do the opposite.

In a real jam the harmony is the *stable* layer. A form gets called - a minor blues, rhythm
changes, a two-chord vamp - and then it repeats unchanged for as many choruses as anyone wants
while the interest comes from who is playing, how loudly, in what register and with what feel.
Changes are rare, signalled events: a nod, "last time", "to the bridge". Nobody changes the
chords every eight bars. The most useful thing the local library has to say about this is a line
meant for answer shape rather than music - *be predictable in structure and creative in
material* - which is the same principle. The rest of the library points the other way, because it
is written for composed tracks that must hold a listener on one hearing, and a jam has the
opposite priority: predictability is what lets someone else join in.

The app used to be exactly backwards. The prompt told the model that *a change is the default
answer and repeating is the exception*, the candidate scoring deliberately refused to favour
staying put, and the only thing defending a repeat was a 0.05 probability margin. So the chords
changed every eight bars while the drums, bass, pad and figure were canned - variation in the
stable layer, stasis in the expressive one.

Three things changed:

- **The schedule decides *that* the form moves; Jev decides *where*.** `HOLD_FORMS` in
  `harmony.ts` says how many times the form plays before the next one is led from elsewhere. This
  is the part that had to be measured rather than reasoned about. The first attempt asked Jev
  *whether* to move, and Jev - told emphatically that holding is normal - answered **1.00 for
  staying, every time**. It got worse before it got better: an earlier version also required a
  change to beat staying put by `CHANGE_MARGIN`, and with a 1.00 answer to stay no margin above
  zero can ever be cleared, so the form could not move *at all*. A gate that cannot open is not a
  safeguard, it is a decision never to change. So the call now happens only when a move is due, and
  the stay option is dropped before the question is asked, which leaves Jev answering the question
  it is actually good at: which section should lead next.
- **The variation moved into the playing.** The arrangement masks are two sections long rather
  than one, so the second pass through a section enters and exits on different bars than the first.
  Same form, different arrangement - which is what a band does to a chorus without changing the
  chords.
- **Announcement is part of predictability.** The decision is taken one full section before the
  end, so there is a section of notice rather than the one bar there used to be.

#### A phrase is a section, and the form is what you commit to

Eight bars is not a form. It is a loop, and looping it is not the same as playing music - which is
what the first attempt at this got wrong. The app had thirty-two good bars of material per style
and played them one at a time, re-deciding every eight. The player had no idea what the next eight
bars were, and that uncertainty is not a subtlety; it is the difference between playing along and
guessing.

So a phrase is now a **section**, and each style has a **form**: its sections in a fixed order,
repeating. The whole of it is in the pattern, so the harmony is decided once and then played -
there is no per-section rebuild and nothing to anticipate. `Style.form` is the order, and the form is
treated as a cycle, so the last section leads back to the first.

Both the length of a section and how many there are belong to the style, not to the app. A section
is as long as its own music needs and a form is however many of those read as a piece: eight-bar
sections and four of them for the four dance and jazz styles, thirty-two bars of AABA-shaped
material; twelve-bar sections and three of them for the blues, because a blues chorus is twelve bars
and cutting one down to eight to fit a constant was a compromise the fixed length was forcing. The
generated `PatternPlan` carries `sectionBars` so the bar counter, the section strip, the drum cues
and the notice before a change all read their positions from the music rather than from a number
they share. `validate.ts` checks each style's own sections are a real phrase - even, at least four
bars - rather than that they all match.

Leading from any section is the same form entered further in, which is what `chartSections` builds.
That is why a change is cheap and safe: whatever gets picked, the chart that follows is the style's
own form, and every seam in it has already been checked.

Two rules make a repeating form playable, and both are enforced at import.

`assertChartFlows` requires every section's last bar to land somewhere the next section can
follow, including the wrap. A tonic ending is always fine. A dominant ending is fine only when the
next section opens on the tonic, because a dominant *promises* the tonic. A colour ending is fine
when the next section opens on the tonic - the modal cadence - or on another colour chord, which is
a modal step and the ordinary way one modal section follows another. A subdominant ending needs the
tonic or the dominant. An earlier version asked whether a phrase could loop into *itself*; that was
the right question while a phrase was the whole form, and the wrong one afterwards. Seven phrases
had been written to "hand on" to whatever came next, which reads as purposeful only if something is
actually coming.

`assertEveryStyleHasAHome` requires exactly one section per style to open on the tonic, and
`homeSequence` is how it is found. A session starts there and a style change lands there. That
matters more than it sounds: three of the four sections in every style open on a chord that is not
the tonic, and one of them - the minor two-five in after-hours - opens on the half-diminished two.
Dropping a player onto that means they hear two bars of a chord with nothing to resolve to before
they learn what key they are in. Those openings are worth having as *departures*; what was wrong was
making one of them the entrance.

The stage shows the whole form - four rows of eight bars, the section playing marked, the bars
already played dimmed - and each candidate says which order it would lead, so the next thirty-two
bars are readable rather than implied.

#### Finding your place in thirty-two bars

Reading the form is not the same as hearing it. Thirty-two bars is far too long to hold your place
in by counting, and a player counting is a player not playing, so the arrangement has to say where
you are. Two drum cues do it:

| Cue | Where | What it is |
|---|---|---|
| `drums.fill` | the last bar of **every section** | a pickup on top of the groove - three added snares, or a rim and a snare |
| `drums.turn` | the last bar of the **whole form** | toms and a crash, the only bar in the form where they are ever heard |

Both are *added* to the bar rather than replacing it. That is what the user asked for - "similar beat
but enhanced/changed enough to notice but not feel like it doesn't fit" - and it is also what makes a
cue reliable: the groove never stops, so the cue can never be mistaken for a mistake. It is
`.when(mask, x => x.superimpose(...))`, and at bar 32 both fire, so the top of the cycle is the
busiest bar in the form.

Two details make it work, and both were verified in the page rather than assumed:

- **`when` fires on the last cycle of the group, not the first.** `when("<0 0 0 0 0 0 0 1>", f)`
  applies on cycle 7, which is bar 8 - measured by querying the haps. (`every(8, f)` fires on cycle
  0 instead, which would put the fill on bar 1.) The mask is one value per bar, so this is the same
  absolute-cycle alignment the arrangement masks already rely on.
- **The cue has to be warmed with the kit.** An unwarmed cue would arrive late the first time it
  played - which is exactly the bar it exists to make audible - so `soundsToWarm` reads the cue
  patterns too.

`assertCuesAreDistinct` refuses a style whose two cues are the same pattern, because the whole
value of the pair is that a section end and the top of the cycle do not sound alike. The cue sounds
are drawn from the set every one of the five kits carries (`sd ht mt lt rim cp cr`), so a cue cannot
be silently missing a sample.

Measured on night-drive by querying the app's own emitted pattern over 40 bars: bars 8, 16, 24, 32
and 40 each gain three snares, and `ht`, `mt`, `lt` and `cr` appear on **bar 32 only** - 37 events
against 25-31 elsewhere.

Choosing a phrase by hand works the same way. Clicking one does not cut the phrase that is
playing short: the request is held and takes over at the wrap, so the bar strip keeps showing
what you are hearing while the eyebrow names what is coming and the chosen chip is marked as
queued. Only a style change is applied immediately, and that is deliberate - a phrase belongs to
a style, so "the end of the current phrase" is not well defined across that switch.

#### How a phrase change reaches the bar line

A change is handed to the program **the moment it is decided**, not when it is due, and the
program it is handed to contains both phrases: the rest of the one playing, then the incoming
one, laid out by cycle number.

Strudel plays a slowcat by cycle, so the switch is then a property of the pattern rather than of
when `evaluate` was called, and it lands on the bar line by construction. The earlier version
waited and swapped the program at the bar line instead, which was audible and wrong: by the time
the swap happened the boundary had already been scheduled from the old program, so the new
phrase's first beat came out as the old one and the change only arrived on the next event - the
first beat of the previous sequence, resolving somewhere around the second beat.

Applying it early only sounds early if the program changes what the current bar plays, so the
handoff keeps the bars that are still to come from the phrase in progress, in place. The readout
still describes the phrase you are hearing, and the selection only moves when the change lands.
The one slot that outlives its phrase - the bar in progress when the change was decided - is
gone one bar later, when the app rebuilds the program without a handoff. That rebuild is
inaudible because the handoff already places the landed phrase at that cycle.

`scripts/verify-handoff.ts` checks the composition for every phase of a phrase, in
both directions: the bar in progress never changes, the rest of the phrase plays as before, and
the incoming phrase starts on its own bar 1. It reads the phrase length from the built program,
so it is not tied to any particular length.

The handoff program is two phrases long - sixteen bars - because it has to be a whole number of
phrases and more than one: the incoming phrase needs a bar line to start on and all of itself in
front of it.

```sh
npx tsx scripts/verify-handoff.ts
```

#### The program, and one view per voice

The generated program is one `const` per voice and a final `stack`:

```js
const drums = s("bd*4, ~ cp ~ cp").bank("RolandTR909").lpf(12000).gain(0.8).orbit(1)
const perc = s("[~ oh]*2, [~ hh]*4").bank("RolandTR909").gain(0.34).orbit(1)
const bass = note("<...>").s("gm_electric_bass_pick")....orbit(2)
const pad = note("<...>").s("sawtooth").lpf(1600).attack(0.5).release(0.7).room(0.5).gain(0.17).clip(1).orbit(3).analyze(3)
const chords = note("<...>").s("clavisynth")....gain("<...>").orbit(4)

stack(drums, perc, bass, pad, chords).cps(0.466667)
```

Strudel's transpiler takes statements as long as the last one is the pattern, so the names are
free and the panel shows the program that is really running instead of one long line.

Each voice then gets its own viewing mechanism, all of them Strudel's own renderers, fed with
that layer's haps - a layer is identified by its orbit, the same orbit its mixer gain acts on:

| voice | view | why that one |
|---|---|---|
| Drums | event grid with sample labels | no pitch to plot, so the bar's hits are the information |
| Bass | piano roll | pitch over time, which is what a bass line is |
| Pad | spectrum | a held chord has no events, so its colour is the thing to show |
| Chords | pitch wheel | the figure's notes around the octave, which shows the shape of the loop |
| Keys | oscilloscope | the live voice is not a pattern and has no haps at all |

Two details are worth knowing. The pad's spectrum is fed by Strudel's analyser for that layer's
orbit, created by `.analyze(3)` on the pad - the same mechanism Strudel's own `.scope()` uses -
so it draws nothing until the pad has sounded once. And Strudel's *frequency* renderer reads a
`canvas` binding it declares further down its own body when no analyser is registered yet, so it
throws rather than drawing the idle line its time-domain twin draws; the view skips that frame.

A pad is clipped to its own chord (`.clip(1)`) and given a short release, so a chord cannot ring over the next one.

### Why the rhythms divide 16

The whole arrangement sits on a straight sixteenth grid, and the figure's slot count has to
divide 16 - 8 for eighths, 16 for sixteenths, or 8 with rests for half notes. That is not a
style preference, it is a bug fix worth understanding before changing it.

The original rhythms used 3, 6 and 12 slots per bar. Three, six and twelve events in a four-beat
bar are **not** even subdivisions: they are triplet groupings. So three of the four rhythms put
the chord figure on a triplet grid while every drum pattern stayed straight, and the two layers
sat in a permanent 3:2 polyrhythm. That is why the drums sounded "off from the arps" - not a
scheduling fault at all, but the figure playing triplets over straight beats. Only `syncopated`,
with 8 slots, lined up.

The fix was to move every rhythm onto the 16th grid. `validate.ts` now asserts `16 % slots === 0`
at import, so a rhythm that would break the alignment cannot reach playback.

### The rhythm also picks the notes

Which bar positions a rhythm leaves empty is not only a rhythmic choice. The figure plays
`tokens[slot % tokens.length]`, so the slot number selects the chord tone as well as the timing,
and the first token is the chord's lowest note - the bass.

That made the old `Drift` rhythm unusable in a way that was audible but not obvious: it sounded
slots 0 and 4, so in every arpeggio mode it played the bass note, twice per bar, and in `Block`,
`Rising` and `Broken` it played the *same* note twice. Measured across four styles, four
keys, two phrases per style and every figure mode, the bass note was in **68%** of its events -
**60%** of the arpeggiated ones. It read as a doubled bass line, and because the chord layer
stopped carrying any colour the mid-ground seemed to have been switched off. The pad was never
touched: the rhythm is not an input to whether the pad is in the program at all.

`Lilt` replaces it, sounding slots 1, 2 and 7 - the "&" of 1, beat 2, and the "&" of 4 lifting
into the next bar. It never lands on the downbeat, it puts the bass note in **33%** of the
arpeggiated events, and in C minor over `Cm` it plays `eb3 g3 ... eb3` where `Drift` played the
root. That is what the figure is for: the pad holds the chord, the bass owns the root, and the
figure adds the movement between them.

### The phrase has a shape

Harmony says what is happening. It does not say who is in the room, and until now every layer
was in the room for all eight bars of every phrase, for ever. Each style now has an
`arrangement`: one digit per bar, per decorative layer, saying which bars it plays in. A mask is as
long as a section and repeats with the form, so the gesture belongs to the section whatever its
length; `validate.ts` requires the mask to divide the form and every section-window of it to
contain something.

Only the two decorative layers are listed, and that is the whole design. Dropping the drums,
the bass or the pad for a bar does not read as an arrangement, it reads as a fault - and the pad
is what covers the hole the other two leave. So `night-drive` steps the figure out for bar 5 and
the percussion out for bar 8, which leaves the drums exposed for the turnaround; `broken-beat`
holds the percussion until bar 2 and drops the figure for bar 7; `slow-bloom` states the figure at
each end of the phrase and hands the middle to the pad, with the percussion arriving at bar 5;
`after-hours` drops the comping at bar 4 and the brushes for the last two bars; and `blues` holds
the percussion until bar 2 and drops the comping for the closing bar, which leaves the turnaround
to the band.

It is emitted as `.mask("<1 1 1 1 0 1 1 1>")`, one value per cycle, and one cycle is one bar.
`mask` turned out to be exactly the right tool, and it is worth knowing why it is safe here: it
resolves to `keepif.in`, which is `fmap(func).appLeft(other)`, so the **source** pattern supplies
the structure and the mask only supplies values sampled at each event's onset. Events are removed,
never moved or re-timed - a figure masked at bar 5 leaves every note in the other seven bars
exactly where it was. The alternative, `.struct()`, takes the structure from the mask instead and
would have re-timed the whole layer.

The alignment is free rather than managed. Because Strudel evaluates everything by absolute
cycle, a mask whose bar 5 is a zero and a phrase whose bar 5 is a zero agree by construction, and
they keep agreeing while a phrase change is in flight. Measured on the chords layer over 17
cycles: bar 5 came out at **0.00122** rms against **0.0115-0.0149** for the other seven bars, an
11x drop, and that measurement ran straight through a live handoff from *Home cadence* to *Open
room*. `validate.ts` checks at import that every mask is one digit per bar, that it is only 0s and
1s, and that it never silences a layer outright.

A masked bar is not the same thing as a mute. The mute is the mixer, and you can take any layer
out at any time; this is the arrangement's own presence, and it is part of the music.

### Nothing sits exactly on the grid

Two more borrowings, both deliberately small.

**The filters move.** Every layer used to hold one cutoff for the whole phrase. Now the bass, the
pad and the chord figure each carry a filter envelope, so a held chord opens as it sounds instead
of sitting there as one static block of colour. The pad opens over most of a second
(`lpenv(1.5).lpa(0.9)`), the picked bass cracks open for a fifth of a second and settles back to
its body (`lpenv(1.6).lpd(0.16).lps(0.18)`), and `slow-bloom`'s synth sub takes four tenths of a
second to bloom. `lpenv` is in octaves, so the same number means the same thing at any tempo.

Measured on a single note, as the share of energy above 1.5 kHz - a ratio, so it is unaffected by
the amplitude envelope, which was identical in both runs:

| window after the note | static `lpf(800)` | with the envelope |
|---|---|---|
| 0-40 ms | 0.04% | 2.85% |
| 40-80 ms | 0.05% | 3.51% |
| 80-160 ms | 0.05% | 1.54% |
| 160-240 ms | 0.05% | 0.29% |
| 240-400 ms | 0.05% | 0.27% |

The static filter is flat, as it must be. The enveloped one peaks 70x brighter and is 13x darker
by 160 ms, settling onto a plateau that is the envelope's sustain level - the pluck shape the
parameters describe, arriving when they say it should.

The envelope needs a cutoff to move at all: superdough builds the filter chain only when `lpf` is
set and ignores the envelope controls entirely without one, so a layer with an envelope and no
cutoff is a static filter that looks like it should be moving. `validate.ts` refuses at import to
accept that combination rather than leaving it to be heard.

**Timing and level are loose.** The drums and percussion land a few milliseconds either side of
the grid, and every layer except the pad varies its level from hit to hit, driven by `rand`
sampled at each event's own onset - so a hit differs from its neighbours and a bar differs from
the last time it came round. This is the one thing an exactly quantised drum machine cannot hide,
and it is why a programmed groove can be note-perfect and still sound dead.

Measured on `bd*4`: velocities of 0.880, 0.924, 0.911, 0.903 in one bar and 0.942, 0.967, 0.953,
0.905 in the next, with nudges spanning the full +-4 ms.

Two constraints, both verified rather than assumed. `velocity` multiplies gain in superdough's
shared gain stage, so it applies to any voice - oscillator, sample or soundfont. `nudge` is read
**only by the sample player**, and in **seconds** rather than cycles, so timing is applied to the
two drum layers, which are samples, and would silently do nothing on a synth. And the pad is left
exactly on the grid at a constant level: it is the bed, and a bed that wobbles is a pumping bed.

The amounts are small on purpose. A hi-hat six milliseconds late is a hi-hat played by a person;
six milliseconds early is a mistake.

### Where these came from

The moving filter, the per-bar arrangement mask and the humanising offsets are all techniques from
Switch Angel's live-coding practice. Her custom Strudel scripts are public at
[switchangel/strudel-scripts](https://github.com/switchangel/strudel-scripts), where they appear as
`acidenv`, `track`/`blockArrange` and `humanize`, alongside a `chordshapes` table of 75 voicings
that this project does not use yet.

The ideas are borrowed; the code is not. That repository carries no licence, so everything here is
reimplemented against stock Strudel controls - `lpenv`/`lpa`/`lpd`/`lps`, `mask`,
`nudge`/`velocity`/`rand` - rather than copied. It also turned out that three of her most
characteristic helpers are not stock at all: `acidenv`, `notearp` and `flood` are her own
`register()`ed functions, and are absent from the Strudel this project installs.

Two of her sounds are deliberately left alone. `supersaw` and the `wt_*` wavetables are both
AudioWorklet oscillators with no fallback, so they play **silence** wherever the worklet cannot
load - the trap the pad already fell into once.

### One style, one closed set

A style is a closed arrangement, not a preset you can drift out of. Each one owns its four
phrases, its chord palette, its drum machine, its pad, its chord figure, its bass and its
leads, and nothing is shared between them: not an instrument, not a drum kit, not a phrase.

That is enforced rather than intended. `assertStyleIsolation()` in `validate.ts` runs at import
and throws if any of these is true:

- two styles use the same sound, in any role
- two styles use the same drum or percussion pattern
- two styles declare the same phrase id
- a phrase uses a chord outside its style's palette
- a style has two phrases opening on the same chord
- a style's default lead is not one of its own

The instrument pools are disjoint by role as well, so a lead can never be the sound the chord
figure is already playing:

| Role | Where it may be used | Why |
|---|---|---|
| `solo` | the live keyboard voice only | it needs a real release, so the custom voice plays it |
| `backing` | the pad and the chord figure | it carries a per-layer `gain`, so it must be a sound that honours one |
| `bass` | the bass line only | a real bass instrument in every style, never an oscillator |

Bass uses soundfonts, because a soundfont trigger ignores `gain` (its ADSR is fixed at a 0.3
peak). That turned out to be harmless here, and it was measured rather than assumed: a picked GM
bass and the old `sawtooth` at `gain(0.5)` both peaked at 0.099, so the level landed where the
synth basses already sat.

The pads are the one part of the arrangement that is *not* a sample: they are filtered
oscillators - a saw bed for night drive, a square bed for broken beat, a triangle bed for slow
bloom, and the quiet pipe organ for after-hours. A pad has to be there the moment the transport
starts, and an oscillator needs nothing fetched, nothing decoded and no AudioWorklet, where a
sample-map pad depends on all three. The figure normally stays on a sample map, which is what
gives each style its own comping instrument.

The blues opens the door that leaves: `pad-reed` and `pluck-glass` are the `user` waveform with a
`partials` list each, so superdough builds their spectra out of the numbers instead of a fetch,
and they are oscillators like the pads above. They are the only instruments in the catalogue that
are synthesised outright rather than picked from a map, which is the style asking for a blues band
that leans experimental. Both were measured before they were trusted: the reed bed at 0.103 rms
and the pluck at 0.161, against 0.158 for a plain sine, so the additive route costs nothing in
level. The spectrum belongs to the instrument rather than the style, so `s("user")` always emits
the `partials` that make it a timbre instead of a warning.

Because the candidates a style can move to are its own phrases, Jev cannot steer one style into
another even in principle: the only ids it can answer with are that style's.

### Solo instruments

Each style offers **its own five leads**, drawn from the twenty-five lead instruments in
`samples.ts`. No lead is used by a backing layer, no lead is shared with another style, and the
pad and figure of a style are never on its lead list.

Leads come from two sources:

- **Sample maps** - the multi-sampled concert grand and the VCSL instruments, resolved per
  pitch through `samples.ts`. Good for acoustic piano, harp, marimba, vibraphone and the
  world/plucked colours.
- **General MIDI soundfonts** - `rhodes`, `jazz-guitar`, `clean-guitar`, `voice-oohs`,
  `muted-trumpet`, `clarinet`, `flute`, and the blues' `harmonica`, `overdriven-guitar`,
  `electric-guitar-muted`, `guitar-harmonics` and `lead-2-sawtooth`. These come from
  `@strudel/soundfonts`, and they are the only source of guitars: there is no guitar in the CDN
  sample maps at all (`gtr`, `guitar`, `epiano` and `strings` are all 404), which is why the
  blues - a guitar idiom - is the style that reaches furthest into this family.

**The lead never doubles the chord figure's instrument, by construction.** The two are drawn
from pools that cannot overlap, so `slow-bloom` plays psaltery figures under a harp lead and
`after-hours` plays balafon under a piano, and no choice inside a style can make the lead and
the accompaniment the same sound. An earlier version could be set up that way by hand - two of
the four styles shipped with their lead and their figure on the identical sample - which is why
the roles are now separate types with a startup check rather than a convention.

Two facts about soundfonts decide how the rest of the audio code is written:

- A registered soundfont note **cannot be released** - its trigger returns a no-op `stop`, the
  same limitation as every other Strudel sound. The live solo voice therefore calls
  `getFontBufferSource` directly, gets a real `AudioBufferSourceNode`, and builds its own
  envelope, which is what keeps note-off working. Soundfonts used by the *arrangement* do not
  need this, because those notes have a fixed duration anyway.
- A soundfont trigger **ignores `gain`** because its ADSR is fixed at a peak of 0.3. Anything
  using one for level control has to use `postgain` instead, which is why the layers here
  still use sample maps and synths where the per-layer gain matters.

### Hearing one part at a time

The list of layers is a mixer: every row has `M` and `S` buttons, and a silenced row is dimmed.
`M` silences a part, `S` hears it alone, and with any part soloed the rest are out. Mute wins
over solo, so a part that is both stays silent - the same way every mixer behaves.

Silencing a part is a gain change on that part's own output bus. Each pattern layer is routed to
its own Strudel **orbit** (`.orbit(1)` drums and percussion, `2` bass, `3` pad, `4` chords), and an
orbit's `output` is a real `GainNode`, so a part stops on the note it is already ringing and comes
back the same way. Nothing is re-evaluated and the phrase is not disturbed. The alternative -
rebuilding the program with `gain(0)` on one layer - would re-evaluate the program to change a
mixer setting, and the silenced layer would still be scheduled, just silent.

The solo row is the live keys rather than a pattern layer, so its mute goes to the voice that
plays your MIDI instead of to an orbit. The levels are re-applied after a stop and restart,
because Strudel rebuilds its orbits when it resets.

### Loading and balance

- The sample maps load at startup. The audio files behind them load lazily by default, so the
  arrangement warms every sound it will actually trigger: **each distinct note of every chord
  and every bass figure**, not one representative note per chord. A pitch-keyed map resolves a
  different file per pitch and a soundfont a different zone, so warming a single note would
  still leave the rest to arrive on first play.
- Soundfonts are warmed by resolving the font buffer and **never starting it**. A soundfont
  trigger ignores `gain`, so warming one through `superdough(gain: 0)` would not be silent;
  resolving the buffer fills the same cache silently.
- Warming is deduplicated per sound, so re-running it on every Jev decision costs nothing, and
  the whole set is prepared **before playback starts** rather than after the first bar.
- The solo voice preloads every note of the configured key range (C3-B4 by default, adjustable,
  and it widens automatically to match what you actually play). For a soundfont that means one
  cached buffer per note of the range.
- The control rail reports what is ready - `prepared 24 solo · 52 backing · Jazz guitar`.
- The backing layers sit below the lead by design; drum, bass, pad and chord gains were trimmed to make room for it, and the lead has its own level control rather than relying on that trim. See *The lead level* below.

## Connecting a MIDI Keyboard

No drivers are needed for class-compliant USB MIDI devices on Windows or macOS (this includes the LUMI Keys). The app previously showed "waiting for connection" because it never called the Web MIDI API - that text was static. It now requests access for real.

Requirements for the keyboard to appear:

1. **Use Chrome or Edge.** Web MIDI is not implemented in Firefox or Safari.
2. **Serve over `https://` or `http://localhost`.** Other origins are not a secure context and the API is unavailable.
3. **Allow MIDI when the browser asks**, or via the padlock icon → Site settings → MIDI. If it was blocked once, the UI reports it and you can press *Rescan MIDI* after changing the setting.
4. **Press Start, or Connect MIDI.** The request is made from the page; the panel then lists every input device by name.

Device changes are picked up automatically, so plugging the keyboard in after the page has loaded is fine. The panel shows the notes currently sounding (including pedal-held notes) and the last CC value, which is also part of the snapshot sent to Jev.

### Hearing your keys

Notes are played through the same Strudel audio engine the jam uses, so they arrive as soon as Strudel has been initialised:

1. Press **Start** once. Browsers only allow audio to begin after a click, and a MIDI message is not a user gesture.
2. After that, every key you play is heard - even when the jam itself is stopped, because stopping only silences the pattern.
3. Use **Play my keys** to toggle monitoring and **Audition** to play a short chord through the current instrument.

### The lead level

The complaint that produced this control was that the lead was still often too quiet, and the
first version of the fix - a plain gain before the master - barely helped. The reason is worth
keeping: the old fixed level already put a single note within half a decibel of the ceiling an
`AudioContext` destination can take. There was no headroom left to hand out, and the jam's own
layers are summing into that same master, so a control that only scales amplitude had almost
nothing to give.

So the control drives a compressor instead and the loudness comes from density rather than peak.
Turning it up trades peaks for average level, which is what is actually heard as louder. The
stage is:

```
gain (the control)  ->  compressor (threshold -6 dB, knee 6, ratio 3)  ->  makeup 1.4  ->  soft clipper
```

The clipper saturates to exactly 1, so a chord at the top of the range cannot reach the master's
hard clip and crackle; below 0.6 its curve is the identity, so normal playing passes through
untouched. The compressor threshold sits below the lead's normal peak, so this is not only a
top-of-range effect. Measured on a four-note chord through **Audition**, average level rises
monotonically across the whole range - 0.18 at 0.4x, 0.34 at 1.0x, 0.44 at the 2x default, 0.49
at 3x, about 8.7 dB end to end - while the peak never exceeds 0.91, so nothing clips at any
setting. A low setting still behaves like the plain fader it looks like.

The level is kept out of `Selection` on purpose. `plan` is memoised on the selection, so putting
it there would rebuild and re-evaluate the Strudel pattern on every drag of the slider. It is
persisted to `localStorage` instead, and applies to notes that are already ringing rather than
only the next one.

If you hear nothing, check in this order: the "Play my keys" switch, the AudioContext state (the voice stays silent unless it is `running`), the instrument palette, and the browser tab's audio output.

### Why the live voice builds its own envelope

Strudel's trigger can start a note but never stop one. All three of these were checked against 1.3.0:

- `superdough(...)` resolves to `undefined` - no node handle.
- `getSuperdoughAudioController()` exposes only `audioContext`, `output`, `nodes`, `buses`, `reset`, `duck`, `getOrbit`, `getBus` - no release or stop.
- `getTrigger('triangle')` returns a function, but the object it returns carries no `stop`.

So a pattern note lasts exactly its `duration` and cannot be choked. To make releases follow the key, `src/audio/liveVoice.ts` builds the envelope on Strudel's own `AudioContext` and connects into Strudel's master output (`getSuperdoughAudioController().output.destinationGain`, a real `GainNode`). The keys therefore share the same context, master chain and effect sends as the jam.

Also handled: retriggering a held key fades the previous note, polyphony is capped at 16 voices, unplugging the keyboard releases anything it left held, and switching "Play my keys" off or leaving the page releases every sounding note.

The sustain pedal is tracked, displayed and sent to Jev, but does not yet extend live notes.

The solo voice plays sampled instruments. Samples are keyed by pitch, so a key press picks the nearest recorded pitch and shifts it by at most a semitone or two, which is why the instrument stays in tune across the keyboard. The key range you set is preloaded and decoded ahead of time, so playing does not wait on the network; the range widens by itself if you play outside it.

The catalogue is one acoustic piano plus electric (FM piano, clav synth), cosmic (wineglass, organ), plucked (strumstick, dantranh, harp) and mallet (vibraphone, marimba) colours. There is no bare-oscillator option - if a sample map cannot be fetched the voice falls back to an oscillator so the keys are still heard.

True guitar samples are not in the default pack set: the CDN only carries the maps listed above, and `dough-samples` holds just the piano. The plucked-string options are the closest available; a real guitar would need an extra pack registered in `SAMPLE_PACK_URLS`.

One caveat from the local environment, and it is not harmless: Strudel logs `Failed to construct 'AudioWorkletNode'` at startup here, because its DSP worklet does not load in this browser. Oscillator and sampler playback is unaffected, and the worklet-based effects (`distort`, `crush`) simply do not apply. A `wt_*` wavetable layer is a third case: those names are AudioWorklet oscillators rather than samples, so where the worklet cannot load the layer plays silence with no error to explain it. That is why this app's pads are oscillators rather than wavetables - a pad layer must never be the thing that is missing - and it is why `uzu-wavetables` is no longer among the registered packs.

## Architecture

```text
React UI
  |-- session controls + visible musical choices
  |-- Strudel adapter  -> domain/pattern.ts pattern builder -> evaluate()
  |-- MIDI adapter     -> requestMIDIAccess -> note/pedal snapshot
  `-- Jev client (/api/decision)
          |
          `-- local Node proxy (server/jevProxy.ts)
                    |
                    `-- TypeSafeClient.systemOne
```

The browser never receives the TypeSafe API key. Jev receives structured state and `choice` questions, never a prompt asking for text or executable Strudel code. Responses are validated against the local allowlists in `src/domain/vocabulary.ts`, `chords.ts`, `figures.ts` and `styles.ts` before they affect the UI or audio.

## Important Contracts

The installed TypeSafe SDK is `@typesafe-ai/sdk@0.6.0`, and one call can carry several named questions:

```ts
import { choice, TypeSafeClient } from '@typesafe-ai/sdk'

const client = new TypeSafeClient({ apiKey })
const result = await client.systemOne({
  state: { style, key, tempo, midi },
  questions: {
    harmony: choice('Choose the next harmonic direction.', {
      i: 'Return home to the root minor chord.',
      iv: 'Move to the subdominant for a stable lift.',
    }),
    rhythm: choice('Choose the rhythmic feel for the next section.', {
      pulse: 'Steady, evenly spaced motion.',
      syncopated: 'Off-beat push with rests.',
    }),
  },
})
```

### Strudel packages need one shared instance

`@strudel/web@1.3.0` resolves to a pre-bundled `dist/index.mjs` that **inlines its own copy of
`@strudel/webaudio`**, and it comments soundfont registration out of its prebake
(`/* , registerSoundfonts() */`). So the `gm_*` family does not exist in this package at all,
and calling `registerSoundfonts()` from `@strudel/soundfonts` registers those sounds into a
*different* module instance than the app's own `superdough` and `getSound` read from.

The symptom is silent rather than loud: `s("gm_flute")` resolves to nothing and plays nothing,
with no error anywhere. The fix is in `vite.config.ts`:

```ts
alias: [{ find: /^@strudel\/web$/, replacement: './node_modules/@strudel/web/web.mjs' }]
```

Pointing the package at its unbundled entry gives the whole app one shared instance of core,
webaudio, mini, tonal and transpiler, so registration and lookup agree. Verified with
`getSound('gm_flute')` before and after: `undefined`, then a sound object.

The same trap sits in two more packages, both of which bundle their own copy of `@strudel/core`,
so all three are aliased to their unbundled entries:

| package | why |
|---|---|
| `@strudel/web` | the `gm_*` registry, above - silent soundfonts without it |
| `@strudel/draw` | `@strudel/webaudio/scope.mjs` imports it for `getTheme`, so the engine's analyser views would read an uninitialised second core |
| `@strudel/soundfonts` | imported for `registerSoundfonts`, and its bundle carries a third copy of core |

Only the first failure is loud about it. The other two surface as
`ReferenceError: Cannot access 'u' before initialization` from a minified bundle, at the moment
something reaches into the duplicate's state - here, the first frame a spectrum tried to draw.

### How this project talks to Jev

Jev is used as a fast ranker, not as a composer. Code owns the musical reasoning; Jev owns the
taste call. One bar before a phrase ends:

1. `src/domain/harmony.ts` scores the style's own phrases against the chords leading into the
decision - a dominant wants the tonic, a subdominant wants the dominant, a tonic wants to leave
home - and keeps three or four.
2. The request carries the key, the chords leading in, how many times the phrase has repeated,
and those candidates, each with the chord it opens on and what it would do.
3. Jev answers with a `choice` over the candidates. It cannot invent a chord: the answer is
validated against the ids that were sent, and the chords themselves are validated server-side
against the shared vocabulary.

The candidate that just played is always among the options, so "keep going" is never silently
removed. The candidate scoring deliberately gives it no bonus, because a phrase that loops well
resolves into its own opening and would otherwise win on the rules alone, turning Jev's choice
into a formality.

This shape is why the request got cheaper as well as better: the ranking call runs at roughly
900-1150 input tokens, against roughly 1400 when the model was handed a fixed list of whole
sequences and asked to reason about them.

Jev can also be switched off from the rail. With the switch off nothing is sent at all - the
phrase simply repeats - and a change Jev had already asked for is dropped, while one the player
asked for is left alone, because that was never Jev's to cancel. Picking a phrase by hand and
pinning one work exactly as they do with Jev on.

The answer is handed to the program as soon as it arrives rather than held until the wrap, which
is what keeps a change prompt: see *How a phrase change reaches the bar line*. A slow answer is
no longer a missed change - it lands on the next bar line whenever it arrives.

The conventions below come from the TypeSafe documentation and the locally installed
`typesafe-ai` skill, and they are what `server/jevProxy.ts` and `src/ai/jevEngine.ts`
implement:

- **One request carries every question the loop might need.** Sequence and rhythm are
  asked together rather than in two round trips.
- **Options carry structured criteria.** Confusable sequence options use `what` / `when` /
  `not_for` instead of one flat sentence, because both the option names and their
  descriptions are sent to the model, so the descriptions have to separate the options.
- **Question fields are separated.** `question` states the decision, `focus` names the
  evidence to weigh (`recentSequences`, `midi.activeNotes`, `midi.avgVelocity`) and
  `note` states that this is a taste decision, not a correctness one.
- **Nested state is referenced with backticked paths.** The state is sent as `midi` and
  `recentSequences`, and the questions reference those paths directly.
- **Confidence is per answer.** Sequence and rhythm confidence are reported and displayed
  separately and never averaged: confidence describes how concentrated one answer's
  distribution is, not whether the workflow as a whole can be trusted.
- **Full probabilities are kept**, not only the winner. The UI lists the top options and
  their shares so the reasoning is visible.
- **Low confidence does not block a harmless preference.** The docs are explicit that a
  taste decision need not be refused for being flat, so the only policy added here is
  *stability*: the phrase changes only when the winner's share beats staying put by at least
  0.05. A tie holds the current phrase, since a tie carries no mandate to change.
- **A stale answer is dropped.** The queued decision records the style it was built for, and
  an answer whose style has since been left is discarded rather than applied. Without that, a
  slow reply could override an explicit style change - which it did, once.
- **The key stays server-side.** The proxy reads `TYPESAFE_API_KEY` from `.env`; the
  browser only ever calls `/api/decision`.
- **Every decision is logged** as `[jev] <from> -> <to> (<conf>) | rhythm ... | tokens=...
  model=...` so state, candidates, answers and cost can be inspected afterwards.

The installed Strudel web package is `@strudel/web@1.3.0`. Its browser lifecycle is `initStrudel()` after a user gesture, `evaluate(...)` to start or replace a pattern, and `hush()` to stop it. The package has no TypeScript declarations, so this project keeps a narrow local declaration in `src/types/strudel-web.d.ts`.

Pitfalls this project already accounts for:

- `evaluate(code)` autoplays by default (`evaluate(code, autoplay = true)` calls `repl.setPattern(..., true)`), so a trailing `.play()` double-schedules the pattern.
- Use `note(...)`, never `n(...)`, to set pitch on a synth sound. Superdough resolves synth harmonics from `partials ?? n`, so `n("c3 e3 g3").s("sawtooth")` feeds a non-numeric string into `new Float32Array(value)`, producing a zero-length array and throwing `createPeriodicWave: The length of the real array provided (1) is less than the minimum bound (2)`. `n()` is for sample selection and scale degrees; `note()` sets frequency.
- The only synth sounds registered by `@strudel/web` are `sine`, `triangle`, `square`, `sawtooth`, `user` and `one` (plus the `sin`/`tri`/`sqr`/`saw` aliases). `user` requires `.partials([...])` or it warns and falls back to a triangle - which is why the blues' two additive instruments carry a `partials` list on the instrument rather than on the style, so the call cannot be forgotten at the call site. Instrument palettes are built from these sounds only - `s("bd")`-style drum names would need `samples(...)` and a network fetch at startup.
- `.cps()` on the outer pattern changes the running tempo, which is how the Tempo slider takes effect (`cps = bpm / 240`).

## Next Steps

1. Let played MIDI notes influence the harmony choice directly (call and response), rather than only being reported to Jev as context.
2. Quantize accepted decisions to the next bar boundary instead of swapping patterns immediately.
3. Add a drum-fill and a bass-instrument choice per style; bass is currently a filtered synth except in the jazz style.
4. Load per-pitch sample sets for the remaining solo instruments so no rate-shifting is needed at all.
5. Add focused tests for MIDI normalization (pedal, velocity-0 note-off), the pattern builder, sample-name validity, invalid Jev responses, and the proxy's missing-key path.
6. Measure local Jev latency; do not treat 200 ms as a guarantee. Each answer has its own confidence, and a flat distribution is normal for a taste decision - the sequence only has to beat `repeat` for the change to be worth making.
6. Review Strudel's AGPL obligations and TypeSafe terms before any public distribution.

This remains a private experiment. Public hosting, authentication, multi-user sessions, unrestricted model-generated patterns, and production abuse controls are out of scope for the current milestone.
