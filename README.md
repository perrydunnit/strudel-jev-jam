# Jev / Strudel Jam Partner

A private local prototype for an AI jamming partner. Strudel owns browser audio and layered synth sound design, Web MIDI supplies musical snapshots, and TypeSafe's Jev chooses the harmonic direction and rhythmic feel.

## Current State

Working end to end:

- React + TypeScript + Vite app shell.
- Three-layer sound design per direction: a stacked chord **pad**, a root **bass**, and a **motion** layer that follows the arpeggiation and rhythm choices.
- Choices are visible and playable in the UI: 5 harmonic directions, 5 arpeggiation figures, 4 rhythm patterns, 4 instrument palettes, plus style, key and tempo. The `Key` selector transposes with correct accidentals, and `Tempo` drives the Strudel clock.
- A "What is playing right now" panel shows the notes of each layer and the exact Strudel program being evaluated.
- Real Web MIDI: `requestMIDIAccess`, device list, hot-plug rescan, note-on/off (including velocity-0 note-off), sustain pedal, and the live notes/pedal state surfaced in the UI.
- MIDI notes sound through Strudel's audio engine: each key press starts a note with the selected instrument's key voice (velocity mapped to gain), and each key release fades it out, so note length follows the key.
- A "Play my keys" switch and an *Audition* button let you verify the routing without touching the keyboard.
- A local Jev proxy sends structured state to `TypeSafeClient.systemOne` and asks two `choice` questions (harmony + rhythm); Jev is re-asked every 8 seconds while the jam runs.
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
npx tsc --noEmit --ignoreConfig --module NodeNext --moduleResolution NodeNext --target ES2023 --types node server/jevProxy.ts
```

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
3. UseLive voice       -> superdough(note, deadline, duration) per key press
  |--  **Play my keys** to toggle monitoring and **Audition** to play a short chord through the current instrument.

If you hear nothing, check in this order: the "Play my keys" switch, the AudioContext state (the voice stays silent unless it is `running`), the instrument palette, and the browser tab's audio output.

### Why the live voice builds its own envelope

Strudel's trigger can start a note but never stop one. All three of these were checked against 1.3.0:

- `superdough(...)` resolves to `undefined` - no node handle.
- `getSuperdoughAudioController()` exposes only `audioContext`, `output`, `nodes`, `buses`, `reset`, `duck`, `getOrbit`, `getBus` - no release or stop.
- `getTrigger('triangle')` returns a function, but the object it returns carries no `stop`.

So a pattern note lasts exactly its `duration` and cannot be choked. To make releases follow the key, `src/audio/liveVoice.ts` builds the envelope on Strudel's own `AudioContext` and connects into Strudel's master output (`getSuperdoughAudioController().output.destinationGain`, a real `GainNode`). The keys therefore share the same context, master chain and effect sends as the jam.

Also handled: retriggering a held key fades the previous note, polyphony is capped at 16 voices, unplugging the keyboard releases anything it left held, and switching "Play my keys" off or leaving the page releases every sounding note.

The sustain pedal is tracked, displayed and sent to Jev, but does not yet extend live notes.

## Architecture

```text
React UI
  |-- session controls + visible musical choices
  |-- Strudel adapter  -> domain/music.ts pattern builder -> evaluate()
  |-- MIDI adapter     -> requestMIDIAccess -> note/pedal snapshot
  `-- Jev client (/api/decision)
          |
          `-- local Node proxy (server/jevProxy.ts)
                    |
                    `-- TypeSafeClient.systemOne
```

The browser never receives the TypeSafe API key. Jev receives structured state and `choice` questions, never a prompt asking for text or executable Strudel code. Responses are validated against the local allowlists in `src/domain/music.ts` before they affect the UI or audio.

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

The installed Strudel web package is `@strudel/web@1.3.0`. Its browser lifecycle is `initStrudel()` after a user gesture, `evaluate(...)` to start or replace a pattern, and `hush()` to stop it. The package has no TypeScript declarations, so this project keeps a narrow local declaration in `src/types/strudel-web.d.ts`.

Pitfalls this project already accounts for:

- `evaluate(code)` autoplays by default (`evaluate(code, autoplay = true)` calls `repl.setPattern(..., true)`), so a trailing `.play()` double-schedules the pattern.
- Use `note(...)`, never `n(...)`, to set pitch on a synth sound. Superdough resolves synth harmonics from `partials ?? n`, so `n("c3 e3 g3").s("sawtooth")` feeds a non-numeric string into `new Float32Array(value)`, producing a zero-length array and throwing `createPeriodicWave: The length of the real array provided (1) is less than the minimum bound (2)`. `n()` is for sample selection and scale degrees; `note()` sets frequency.
- The only synth sounds registered by `@strudel/web` are `sine`, `triangle`, `square`, `sawtooth`, `user` and `one` (plus the `sin`/`tri`/`sqr`/`saw` aliases). `user` requires `.partials([...])` or it warns and falls back to a triangle. Instrument palettes are built from these sounds only - `s("bd")`-style drum names would need `samples(...)` and a network fetch at startup.
- `.cps()` on the outer pattern changes the running tempo, which is how the Tempo slider takes effect (`cps = bpm / 240`).

## Next Steps

1. Let played MIDI notes influence the harmony choice directly (call and response), rather than only being reported to Jev as context.
2. Quantize accepted decisions to the next bar boundary instead of swapping patterns immediately.
3. Add focused tests for MIDI normalization (pedal, velocity-0 note-off), the pattern builder, invalid Jev responses, and the proxy's missing-key path.
4. Reconnect supervision: resume MIDI automatically after a device is unplugged and replugged.
5. Measure local Jev latency; do not treat 200 ms as a guarantee. Reported confidence is the weaker of the two answers, so it can be low even when the result is musically fine.
6. Review Strudel's AGPL obligations and TypeSafe terms before any public distribution.

This remains a private experiment. Public hosting, authentication, multi-user sessions, unrestricted model-generated patterns, and production abuse controls are out of scope for the current milestone.
