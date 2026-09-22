---
name: blues
description: 'The twelve-bar blues as this repository plays it: the chorus and its variants (plain, quick change, IV-first, minor, chromatic, 16-bar, jazz blues), the last-four-bar turnaround, the blue-note rule that decides which chords can carry it, the I7 = V7/iv convention and why, why a blues section is twelve bars here rather than eight, the straight-eighth constraint that stops it being a shuffle, the signals that let a player count the chorus, and the faults already found in this catalogue. Use when writing, auditing or extending blues material in this app, when a chorus will not turn over, when a jam partner cannot hear where the form is, when asked about 8-bar blues, or when adding a blues-derived style. Trigger phrases: blues, 12-bar, twelve-bar, 8-bar, chorus, turnaround, quick change, blue note, I7, IV7, V7, shuffle, head, solo, LinnDrum, V7/iv.'
---

# Blues

The blues is a **form**, not a progression. A progression is a loop; a blues is a counted
unit — twelve bars that a room agrees on, so that anyone can join in without being told
what is coming. That distinction is the whole reason this file exists: everything that makes
a blues playable comes from the form being shared and countable rather than from the chords.

It is also the reason the blues is the odd one out in this catalogue. Every other style here
is built from a phrase and its variations; a blues is built from a **chorus**, and the
chorus is the thing that has to be the right length.

This file was written against this repository — the chord vocabulary in `src/domain/chords.ts`,
the rules in `src/domain/validate.ts`, the style table in `src/domain/styles.ts` — and against
the two music libraries in `.agents/skills/`. Where a claim comes from outside those, it says so.

## Boundaries

| Decided elsewhere | Where |
|---|---|
| Which chords exist, their offsets and roles | `src/domain/chords.ts` |
| Cadence types, substitution, secondary dominants, tensions, blue notes as a *device* | `mc-harmony` |
| Named progressions, the eight variation techniques, the models-default-to warning list | `mc-progressions` |
| Beat feel, syncopation, weight of the bar, groove | `mc-rhythm-groove` |
| Which instrument carries which line, spectrum budget, masking | `mc-texture-layering`, `mc-sound-design` |
| Making a groove sound played rather than programmed | `mc-rhythm-section` — **not installed**, see below |
| What a section of *this app* has to satisfy to load at all | `src/domain/validate.ts` |

`mc-rhythm-section` is referenced throughout the `mc-*` library but cannot be installed —
its frontmatter has an unquoted colon in the description and the installer skips it. So the
drum-programming half of the blues has no reference here except this file and the repo notes.

## The chorus

The standard form, as documented in `.agents/skills/music-composition/assets/form-templates.md`:

```
| I  | I  | I  | I  |   (or I-IV-I-I, the "quick change")
| IV | IV | I  | I  |
| V  | IV | I  | I  |   (or V in the last bar; the last four bars are the turnaround)
```

Three things about this are worth stating plainly, because they are what the form *is*:

- **Eight of the twelve bars are the tonic.** A blues spends two thirds of its time at home.
  That is why it is easy to solo over and why a bassist can walk it — and it is why adding
  chords "to make it interesting" is the fastest way to destroy the form.
- **The IV arrives in bar 5, or in bar 2 if it is a quick change.** That single decision is
  the difference between the two most common choruses in the repertoire, and it changes the
  feel more than substituting any chord does.
- **The last four bars are a turnaround, not an ending.** They are written to send the chorus
  back to the top, so the form turns over rather than stopping.

## The variants are harmonic-rhythm decisions

This is the most useful idea in the file. `mc-progressions` §3 makes the point that a
generative model is well trained on *which* chords to use and weak on *when they change*, and
concludes that harmonic rhythm is the cheaper differentiator. The blues is the form where that
is most true: **nearly every named blues variant is a decision about which bar a chord arrives
in, not about which chord it is.**

| Variant | What actually changes | Chorus |
|---|---|---|
| Plain | the IV waits for bar 5 | `i i i i \| iv7 iv7 \| i i \| V7 iv7 \| i i` |
| Quick change | the IV arrives in bar 2, as a resolution | `i iv7 i i \| iv7 iv7 \| i i \| V7 iv7 \| i V7` |
| IV first | the chorus opens on the subdominant, so the tonic is the answer | `iv7 iv7 i i \| iv7 iv7 \| i i \| VI bII \| V7 i` |
| Minor blues | the flat sixth is stated before the dominant | `i i i i \| iv7 iv7 \| i i \| VI V7 \| i V7` |
| 16-bar | the four-bar tonic section is stated twice, so half the form is home | `i i i i \| i i i i \| iv7 iv7 \| i i \| V7 iv7 \| i i` |
| 8-bar | a different repertoire item, not a shortening of this one | **not documented in either library** — do not invent it. This app once played 8-bar reductions of the 12-bar form and they were the wrong shape |

One further variant is documented, and it is the most reharmonized of them. Both it and the
16-bar above come from `.agents/skills/music-composition/assets/form-templates.md`:

**Jazz blues** (standard reharmonization) — note that the library itself writes bar 4 as
`I7 (V7/IV)`, which is exactly this app's convention:

```
| I7  | IV7   | I7    | I7 (V7/IV) |
| IV7 | ♯iv°7 | I7    | VI7        |
| ii7 | V7    | iii vi | ii V      |
```

**This app cannot play that in full.** The chord vocabulary has exactly one secondary dominant
(`V7/iv`) and no diminished other than `iiø7`, so `♯iv°7` and `VI7` do not exist here. What
survives is the shape, with the I7 written the way this app has to write it:
`V7/iv iv7 V7/iv V7/iv | iv7 ? V7/iv VI | iiø7 V7 i i`. Reaching for the jazz blues is therefore
a reason to extend `chords.ts`, not a thing to fake — a half-stated reharmonization sounds like a
mistake rather than a choice.

## The turnaround

The last four bars are where a blues is won or lost, because they are the only four bars that
do not simply sit at home. The shapes, in rough order of how much they push:

| Bars 9-12 | Effect | Ends on |
|---|---|---|
| `i i i i` | resolved, no push — a verse blues | tonic |
| `V7 iv7 i i` | the plain close: the dominant states, the subdominant answers | tonic |
| `V7 iv7 i V7` | the standard turnaround; the V in bar 12 sends it round | dominant |
| `V7/iv iv7 V7/iv V7` | the I7 shuffle turnaround, the most idiomatic of them | dominant |
| `VI bII V7 i` | the chromatic close: the flat sixth and the Neapolitan into the dominant | tonic |

The choice is not free in this app. `assertChartFlows` requires that a section ending on a
dominant is followed by one opening on the tonic, so a turnaround that ends on `V7` **must**
lead into a section whose first bar is `i`. That constraint is what makes the "last chorus
turns around" gesture safe: the harmony promises the tonic and the next section delivers it.

## Blue notes, and which chords can carry them

`mc-harmony`'s nine-step table lists blue notes as device 13 — the rub of ♭3, ♭5 and ♭7 — and
gives the rule that matters here:

> Blue notes are strongest when the harmony does **not** contain them. To blue a whole piece,
> add ♭III, ♭VI, ♭VII, minor v, I7 and IV7, used non-functionally.

Three consequences for this catalogue:

1. **In a minor key, two of the three blue notes are already in the key.** The ♭3 is the tonic
   triad's third, so `i` contains it; the ♭7 is the seventh of `i7`, `iv7` and `V7` alike. Nothing
   has to be added to harmonise them — they are simply what the key is made of. So the notes that
   still have a rub available are these:

   | Note | Rubs against | Where it can come from |
   |---|---|---|
   | **♮3, the major third** | the key's ♭3 | `V7/iv` — C7's E against C minor's E♭. **This is what makes a blues sound like a blues** |
   | **♭5** | everything | no chord in the vocabulary contains it, so it belongs to the soloist alone |

2. **The I7 is `V7/iv`, and it is the only chord in the vocabulary that carries the ♮3.** `V7/iv`
   is C7 in C minor: C-E-G-B♭. `i7` is C-E♭-G-B♭. They are **not** the same chord re-voiced — they
   differ in the third, and that difference is the whole point, because `V7/iv` is the one chord
   in `chords.ts` that puts a raised third over a tonic root. It is labelled "Turn to iv" because
   that is its functional job, and in a blues it does double duty as the blues I7. This is the
   single most important chord choice in the style. (`i7` is the wrong chord here for two
   separate reasons: it spends the ♭7 in the harmony, and it carries `bass: 10`, so it moves the
   home note down a whole step.)

3. **The flat sixth and the Neapolitan are blue-note chords.** `VI` (A♭) and `bII` (D♭) put the
   ♭6 and ♭2 in the harmony and they sound like the blues rather than like a modulation, because
   they are approached and left by step. `bII` also sits on the tritone-substitution root of
   `V7`, which is the "inside" name for the same sound.

The vocabulary has no chord on the flat fifth at all, so the ♭5 has nowhere to live in the
harmony. That is the right answer for this app: leave it to the soloist.

## Conventions this repo has settled on

| Decision | Why |
|---|---|
| The tonic is `i`, the I7 is `V7/iv` | the I7 is the only chord that carries the ♮3, which is the one blue note a minor key cannot supply itself |
| All keys are minor — there is no major blues | `KEYS` holds C, D, F and A minor and nothing else, so this is the minor blues. Disclosed, not accidental |
| Straight eighths, not a shuffle | A shuffle means triplets; `assertRhythmsDivideTheGrid` refuses a figure that does not divide the sixteenth grid. This is the one place the style is not the idiom it is named for |
| Twelve-bar sections, three of them | A chorus is twelve. The style's sections are 12 bars and its form is 36, where the other styles are 8 and 32 |
| A section is even and at least 4 bars | `assertSectionsAreWellFormed` — a chorus of 12 is fine, a chorus of 11 is not |

The kit is LinnDrum, which carries `bd sd hh oh cp rim rd cb sh tb ht mt lt perc cr` — all fifteen
verified live against `getSound('LinnDrum_<name>')` in this app. Other machines carry a subset of
those names, and a missing name fails **silently**, so check before using one on a different bank.
The bass is a synth with a filter that cracks open on every note; the pad and figure are additive
`user` instruments, which means they need `partials` on the *instrument* or they silently fall
back to a triangle.

## The catalogue as it stands

Three choruses, twelve bars each, form `['blues/twelve', 'blues/chromatic', 'blues/quick']`:

| id | Label | Bars |
|---|---|---|
| `blues/twelve` | Twelve-bar blues | `i i i i iv7 iv7 \| i i V7 iv7 i i` |
| `blues/chromatic` | Chromatic blues | `iv7 iv7 i i iv7 iv7 \| i i VI bII V7 i` |
| `blues/quick` | Quick change | `V7/iv iv7 V7/iv V7/iv iv7 iv7 \| V7/iv V7/iv V7 iv7 V7/iv V7` |

Openings are `i`, `iv7` and `V7/iv` — distinct, which `assertStyleIsolation` requires, and
exactly one of them opens on the tonic, which `assertEveryStyleHasAHome` requires. Only
`blues/quick` ends on a dominant, so it is the one that must be followed by `blues/twelve`;
that is why the form closes with it.

The arrangement is a chorus-long mask that repeats with the form: percussion waits for the
second bar, and the comping steps out of the twelfth, which is where the section fill lands.

## How a jam knows where it is

A blues is played by people who are counting, and the count is carried by **cues, not by
chords**. In this app:

- `drums.fill` fires on the last bar of **every** section — bars 12, 24 and 36 of the form.
- `drums.turn` fires on the last bar of the **whole form** — bar 36 only.

So a player gets a fill every chorus, and a bigger gesture at the end of the set. When
extending the style, keep those two doing that job: the fill says "count the chorus", the turn
says "the form is about to restart". Losing the distinction is how a form stops being countable.

The other jam signals are structural and already enforced: the form is 36 bars and stable for
two passes before it moves, and a change always lands on the bar line. See the README section
on the form for why.

## Faults already found here

Each of these was found by ear in this catalogue and then turned into a rule. Check for them
before adding a chorus.

| Fault | What it sounds like | The rule |
|---|---|---|
| Two sections share their second half | one chorus plus variations on its back half | `assertSectionsDiffer` — no two halves identical |
| A half is the *rotation* of a neighbouring half | eight bars where nothing new happens; the arrival sounds like it keeps failing | `assertNeighboursDiffer` — no consecutive units that are the same unit entered differently |
| The descent lands on a dominant and is abandoned | the ear waits for the tonic and does not get it | state the resolution, or end the section on the tonic |
| Too many chords, one per bar | it stops sounding like a blues and starts sounding like a standard | most blues bar-pairs are static; move the IV, not everything |
| A blue note inside the chord | the colour is spent before the player can use it | keep the tonic a plain triad |
| A section ending on `V7` followed by anything but a tonic | the promise is not kept | `assertChartFlows` |

The catalogue also carries one honest limitation: a rule that flags "a dominant at the
midpoint that does not resolve" reports `V7/iv → iv7` as a fault, but that is *the* blues move —
a secondary dominant resolving to its own target. The audit is a diagnostic, not an assertion.

## Before adding a chorus

1. Is it twelve bars, and is the IV's arrival bar the thing that distinguishes it?
2. Does it open on a chord no other blues section opens on, and is it the only tonic opening
   if it opens on the tonic?
3. Do its two halves differ by at least three bars positionally, and is neither half a rotation
   of the other — or of the halves either side of it in the form?
4. Does it end somewhere the next section can follow? A dominant ending needs a tonic opening.
5. Is every chord in the style's palette, and are the blue notes left out of the harmony?
6. Then run it for real — `npx tsx -e "import { styles } from './src/domain/styles.ts'"` — because
   `npx tsc -b` type-checks and **does not execute the import-time assertions**.
