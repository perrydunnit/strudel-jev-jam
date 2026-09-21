---
name: strudel
description: 'Verified Strudel.cc live-coding knowledge for this repo: mini-notation, pattern building, the @strudel/web browser API (initStrudel, evaluate, hush, superdough), the synth sound inventory, trigger/release constraints, and MIDI keyboard integration. Use when writing or debugging Strudel patterns, adding sounds or effects, wiring MIDI input, or when a pattern plays wrongly or not at all. Trigger phrases: strudel, mini-notation, pattern, superdough, evaluate, hush, synth voice, s(), note(), cps, cpm, orbit, room, lpf.'
---

# Strudel

Strudel is TidalCycles' pattern language ported to JavaScript. Patterns are immutable
query functions over time spans; `@strudel/web` runs them in the browser on Web Audio.

Everything below was verified against `@strudel/web@1.3.0` in this repository, by reading
the installed bundle and probing the running app. Prefer these facts over memory.

## Lifecycle

```ts
initStrudel()                 // returns a promise; MUST be called from a user gesture
evaluate(code, autoplay = true)  // transpile, then setPattern(..., true) and start
hush()                        // stop the pattern (does not tear down the AudioContext)
```

- `evaluate()` autoplays. A trailing `.play()` double-schedules the same pattern.
- `initStrudel()` is what unlocks audio: a MIDI message or a timer is **not** a user
  gesture, so audio must be started from a click handler.
- `hush()` only silences the pattern. The AudioContext stays running, so anything else
  routed into the graph keeps sounding.

## Pattern building

Mini-notation: `"a b"` sequence, `"<a b>"` one per cycle, `"[a,b]"` stack/chord,
`"a*4"` fast, `"a/2"` slow, `"a(3,8)"` Euclidean, `"~"` rest, `"a?"` 50% chance.

Compose with `stack(layerA, layerB)`; set tempo on the outer pattern with
`.cps(bpm / 240)` or `.cpm(bpm / 4)`. There is no `setcps` export, but the cyclist reads
`cps` off each hap, so `.cps()` on the outer pattern retimes the running clock.

## Sounds

Only these synths are registered: `sine`, `triangle`, `square`, `sawtooth`, `user`, `one`
(plus the `sin`/`tri`/`sqr`/`saw` aliases). `user` requires `.partials([...])` or it warns
and falls back to a triangle.

Nothing but those synths is registered out of the box, so `s("bd")` and friends need a sample
map registered through `samples(...)` in `initStrudel({ prebake })`, and the `gm_*` family needs
`registerSoundfonts()`. See the next two sections.

Verified controls include `stack note s lpf lpq room roomsize delay delaytime
delayfeedback distort attack decay sustain release gain pan arp partials phases voicing
chord struct slow fast transpose cps cpm scale`. `hpf` is **not** exported - filter with
`lpf` only.

## Samples and sound banks

strudel.cc does not ship samples in the package; the REPL registers sample maps from a CDN.
You can read the exact URLs a running REPL uses without guessing - open strudel.cc and list
its resource timings:

```js
performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\.json/.test(n))
```

That yields the defaults, all CORS-enabled (`access-control-allow-origin: *`):

| URL | Contents |
|-----|----------|
| `strudel.b-cdn.net/uzu-drumkit.json` | plain kit names `bd sd hh oh cp rim rd ht mt lt cb misc`, several variations each |
| `strudel.b-cdn.net/tidal-drum-machines.json` | 683 samples across 71 machines, prefixed `<Machine>_<drum>`, used via `.bank("RolandTR909")` |
| `strudel.b-cdn.net/piano.json` | multi-sampled grand, keyed per pitch (`A0`, `Ds1`, ...) |
| `strudel.b-cdn.net/vcsl.json` | 128 VCSL instruments; melodic ones are pitch-keyed objects |
| `strudel.b-cdn.net/uzu-wavetables.json` | `wt_*` wavetables. **Not plain samples** - see below |

Register them non-fatally so a CDN failure cannot break startup:

```ts
initStrudel({
  prebake: async () => {
    await Promise.all(urls.map(async (url) => {
      try { await samples(url) } catch (error) { console.warn('[samples]', url, error) }
    }))
  },
})
```

Facts worth knowing:

- `samples()` accepts a `strudel.json` URL, an inline map, and the prefixes `github:<user>/<repo>/<branch>`,
  `bubo:<pack>` (maps to `github:Bubobubobubobubo/dough-<pack>`), `shabda:<query>` and `local:`.
- Only the **maps** load up front; audio files load lazily on first play, so the first hit of
  a sound can be late or silent. Warm a sound before relying on it.
- A map entry is either an array (one pitch, several variations - select with `:0`) or an
  object keyed by pitch name (`{ C4: 'C4v8.mp3' }`). Pitch-keyed entries are what make an
  instrument playable with `note()` across a range.
- `.bank("X")` just prepends `X_` to the sample name, so the bank must exist in
  `tidal-drum-machines`. Not every machine has every drum - verify before shipping, because a
  missing name fails silently rather than throwing.
- `wt_*` is a **trap, not a shortcut**. `registerSampleSource` sends any key starting with `wt_`
  to `registerWaveTable`, which builds an **AudioWorklet** oscillator (`wavetable-oscillator-
  processor`) rather than a sample. Where the worklet cannot load - and it does not load in
  every browser - that layer plays silence, with no error to explain it. The files are also
  multi-frame wavetables (~5.9 s), so re-registering them under a plain name does not help:
  as a sample you get a sweep through every frame, not a pad.
- For a pad that is **always there**, use a built-in oscillator. `s("sawtooth")`/`square`/
  `triangle` with `lpf`, a slow `attack`, `room` and a low `gain` is a pad with no fetch, no
  decode and no worklet in the path. Which is the rule this project settled on for its pads.

## General MIDI soundfonts (`gm_*`)

`@strudel/web@1.3.0` does **not** register these. Its bundle has soundfont support commented
out (`/* , registerSoundfonts() */`), so the whole `gm_*` family is missing and
`s("gm_flute")` silently plays nothing. Install and register them yourself:

```sh
npm install @strudel/soundfonts@1.3.0
```

```ts
import { registerSoundfonts } from '@strudel/soundfonts'
// inside initStrudel's prebake:
registerSoundfonts()   // synchronous; records how to load each font
```

**One instance rule.** `@strudel/web` resolves to a pre-bundled `dist/index.mjs` that inlines
its own copy of `@strudel/webaudio`. Anything importing a Strudel package directly - as
`@strudel/soundfonts` does, to call `registerSound` - then writes to a *different* module
instance than your `superdough` and `getSound` read from, and every `s("gm_...")` resolves to
nothing with no error. Alias the package to its unbundled entry so the app shares one instance:

```ts
// vite.config.ts
resolve: { alias: [{ find: /^@strudel\/web$/, replacement: './node_modules/@strudel/web/web.mjs' }] }
```

Check it with `getSound('gm_flute')`: `undefined` means a split registry, an object means it
worked. `registerSoundfonts()` registers all 125 GM names; fonts are fetched on first use.

Facts worth knowing:

- Font files are `https://felixroos.github.io/webaudiofontdata/sound/<font>.js`, read with
  `eval('{' + text.split('={')[1])`. Sizes run from ~23 KB to ~1.2 MB. All 125 instruments have
  a working *first* variant; some later variants are broken in the package (for example
  `0330_FluidR3_GM_sf2_fible`, a typo). `s("gm_x")` with no `n` uses index 0, so index 0 is the
  one to rely on.
- The name list lives in `@strudel/soundfonts/gm.mjs` (default export: `gm_*` -> font files).
  The package has no `exports` field, so that subpath import resolves. Pad names are shortened:
  `gm_pad_warm`, not `gm_pad_2_warm`.
- **A soundfont note cannot be released.** The registered trigger returns a no-op
  (`const stop = (releaseTime) => {}`), exactly like every other Strudel sound. When key-up must
  be honoured, use `getFontBufferSource(font, { note }, ctx)` from `@strudel/soundfonts`, which
  returns a real `AudioBufferSourceNode` - already pitched and looping where the font loops -
  and build your own envelope around it.
- **A soundfont trigger ignores `gain`.** Its ADSR is hardcoded to a peak of 0.3, so `gain(0)`
  does not silence it and per-layer level control has to use `postgain` instead. This is also
  why warming a soundfont through `superdough(..., { gain: 0 })` is not reliably silent: resolve
  the buffer without calling `start()` instead.
- The CDN sample maps contain no guitar at all (`gtr`, `guitar`, `epiano`, `strings` are 404),
  so guitars have to come from this family.

## Two traps that cost real debugging time

1. **Pitch must use `note()`, never `n()`.** For synth sounds superdough resolves
   harmonics from `partials ?? n`, so `n("c3 e3 g3").s("sawtooth")` sends a note-name
   string into `new Float32Array(value)`, yielding a zero-length array and throwing
   `createPeriodicWave: The length of the real array provided (1) is less than the
   minimum bound (2)`. `n()` is for sample index and scale degrees.
2. **`~` rests must be mirrored in any per-step control.** `note("c3 ~ e3").gain("1 1 1")`
   misaligns; give the gain pattern a matching `~` so no event fires without a value.

## Triggering a single note

```ts
superdough(value, deadlineSeconds, durationSeconds)   // note: MIDI number is accepted
```

`value` is the object a pattern produces, e.g. `{ note: 60, s: 'triangle', lpf: 2000 }`.
Frequency resolves from `value.freq` if present, otherwise from numeric `note` (MIDI) or a
note-name string. `deadline` must be >= `currentTime` or the note is skipped with
"cannot schedule sounds in the past".

## A scheduled note cannot be released

This is the most important constraint for live input, verified three ways in 1.3.0:

- `superdough(...)` resolves to `undefined` (no node handle).
- `getSuperdoughAudioController()` exposes only `audioContext`, `output`, `nodes`,
  `buses`, `reset`, `duck`, `getOrbit`, `getBus` - no release or stop.
- `getTrigger('triangle')` returns a function, but its result carries no `stop`.

So a note lasts exactly `duration`; it cannot be choked on key-up. When a live voice must
follow the key, build the envelope yourself on Strudel's context and connect into
Strudel's master chain (see `src/audio/liveVoice.ts`). When that is not required, prefer
superdough with a deliberate `duration`.

## Routing custom audio into Strudel

`getAudioContext()` returns Strudel's context. The master input is
`getSuperdoughAudioController().output.destinationGain`, a real `GainNode`, so a custom
graph connected there shares Strudel's master chain and destination. `ctrl.output` itself
is not an AudioNode.

## Arrangement patterns

Chord sequences: a slowcat (`<...>`) plays one element per cycle, so wrapping each
bar in brackets gives a looping progression where the harmony moves once per bar:

```js
note("<[c3,eb3,g3] [f3,ab3,c4] [ab3,c4,eb4]>")
```

Track which bar is playing from Strudel's own clock rather than a timer:
`getTime()` returns the scheduler position in cycles, so `Math.floor(getTime()) % bars`
identifies the bar. A decision can then be applied on the bar line.

Stopping a sustained sound at its bar: `.clip(1)` cuts an event at its own duration, which is
what stops a pad from ringing over the next chord. A long `release()` alone will smear across
bars.

Silencing whole bars without disturbing the rest: `.mask("<1 1 0 1 1 1 1 1>")`, one value per
cycle. Its semantics are the reason it is safe to reach for. `mask` is `keepif.in`, which resolves
to `fmap(func).appLeft(other)` - so the **source** pattern supplies the structure and the mask only
supplies values sampled at each event's onset. Events are removed, never moved or re-timed:
measured, `s("bd*2 [~ bd] [bd ~]")` masked to silence one bar in eight still fires at 0, 1/6, 1/2
and 2/3 in every bar it plays in, and `s("bd*4")` yields 4, 4, 0, 4, 4, 4, 4, 4, 4 haps across
nine cycles. Use `.struct()` instead and the structure comes from the mask, re-timing the layer.

### Filter envelopes

`lpenv`/`lpa`/`lpd`/`lps`/`lpq` are **ignored unless the voice also has a cutoff**. superdough
builds the filter chain only when `fx.cutoff` is set (`if (fx.cutoff !== undefined)` in
`superdough.mjs`), so a layer with an envelope and no `lpf` is a static filter that looks like it
should be moving. Beyond that, `createFilter` in `helpers.mjs`:

- with `anchor` unset, sweeps between `min = lpf` and `max = lpf * 2 ** abs(lpenv)`, reversed when
  `lpenv` is negative. So `lpenv` is in octaves and means the same thing at any tempo.
- applies an ADSR to the filter *frequency*, with defaults `[0.005, 0.14, 0, 0.1]` - note the
  **sustain of 0**, so a decaying envelope returns to `lpf` rather than staying open.

Measured on one note, as the share of energy above 1.5 kHz (a ratio, so the amplitude envelope does
not affect it): static `lpf(800)` holds 0.04-0.05% across 0-400 ms, while
`lpenv(1.6).lpa(0.004).lpd(0.16).lps(0.18)` runs 2.85% -> 3.51% -> 1.54% -> 0.29% -> 0.27%.

### Humanising a layer

- `velocity` multiplies gain in superdough's shared gain stage (`gain *= velocity`), so it works on
  every voice - oscillator, sample or soundfont.
- `nudge` is read **only by the sample player** (`sampler.mjs`, `const time = t + nudge`), where it
  is in **seconds**, not cycles. On a synth it does nothing at all.
- `rand` is a signal over absolute cycle time (`getRandsAtTime`), so sampling it at each event's
  onset gives a different value per event *and* per repeat. Measured on `s("bd*4")`: velocities
  0.880, 0.924, 0.911, 0.903 in one bar and 0.942, 0.967, 0.953, 0.905 in the next.

### Scripts that are not stock

Switch Angel's public scripts (`github.com/switchangel/strudel-scripts`) are widely copied, so it is
worth knowing that `acidenv`, `notearp` and `flood` - and the `sc`/`pg` shorthands - are **not**
part of Strudel; they are her own `register()`ed helpers, absent from core, webaudio and superdough
in this version. `acidenv` is five lines: `pat.lpf(100).lpenv(x * 9).lps(.2).lpd(.12).lpq(2)`.
Stock functions that the same scripts do use are `struct`, `mask`, `arpWith`, `unison`, `detune`,
`pan`, `drive`, `ftype`, `postgain` and the whole filter-envelope family.

Preloading without making noise: trigger each sound you will need with `gain: 0` through
`superdough` at a deadline slightly in the future. The sample is fetched and cached, and
nothing is audible. For a custom voice, resolve the sample map yourself and call
`decodeAudioData` over the pitch range you expect.

## Verifying that audio actually fired

Console markers: `[eval] code updated`, `[cyclist] start` / `[cyclist] stop`,
`[superdough] ready`, `[superdough] AudioWorklets loaded`. A silent mistake usually shows
up as a `[cyclist] error` or a `getTrigger` error.

To prove a note reached the audio graph without listening, stop the pattern first, then
count `AudioContext.prototype.createOscillator` (synths) or
`AudioContext.prototype.createBufferSource` (samples) calls while triggering. Measure a
quiet baseline first: some startup errors are logged once regardless of what you play, and
they will otherwise look like a reaction to your change. `superdough`, `note`, `s`, `hush`,
`evaluate`, `getAudioContext` and `midiToFreq` are installed as globals by `initStrudel`'s
eval scope, so any pattern can be tried from the page console without editing the app.

One environment caveat: Strudel's DSP worklet may fail to load, logging
`Failed to construct 'AudioWorkletNode'` at startup. Oscillator and sampler playback still
works, so `distort` and `crush` silently do nothing - and so does any `wt_*` wavetable layer,
which is an AudioWorklet oscillator and plays **silence** rather than a degraded sound.

## Related material not vendored here

The `strudel` skill from [bfollington/terma](https://github.com/bfollington/terma) covers
genre and artist styles, bundled pattern templates, and a URL encoder for sharing
patterns on strudel.cc. It is CC-BY-SA-4.0, so it is not copied into this repo; install it
alongside this skill with:

```sh
npx skills add bfollington/terma -s strudel
```

Official references: [strudel.cc/learn](https://strudel.cc/learn) and the
[technical manual](https://strudel.cc/technical-manual/).
