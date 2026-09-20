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

No drum or noise samples ship with the package, so `s("bd")` and friends need
`samples('github:tidalcycles/dirt-samples')` in `initStrudel({ prebake })` plus a network
fetch. Synthesise percussion from short envelopes instead of assuming samples exist.

Verified controls include `stack note s lpf lpq room roomsize delay delaytime
delayfeedback distort attack decay sustain release gain pan arp partials phases voicing
chord struct slow fast transpose cps cpm scale`. `hpf` is **not** exported - filter with
`lpf` only.

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

## Verifying that audio actually fired

Console markers: `[eval] code updated`, `[cyclist] start` / `[cyclist] stop`,
`[superdough] ready`, `[superdough] AudioWorklets loaded`. A silent mistake usually shows
up as a `[cyclist] error` or a `getTrigger` error.

To prove a note reached the audio graph without listening, stop the pattern first, then
count `AudioContext.prototype.createOscillator` calls while triggering. `superdough`,
`note`, `getAudioContext` and `midiToFreq` are installed as globals by `initStrudel`'s eval
scope, so they can be probed from the page.

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
