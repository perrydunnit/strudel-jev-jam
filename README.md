# README: Jam Partner with Jev & Strudel.cc
## Overview
This project builds an interactive AI jamming partner using Strudel.cc for real-time generative audio and TypeSafe AI's Jev model for ultra-fast, calibrated decision-making.

Instead of generating text, Jev acts as a System One decision engine, continuously evaluating user context (e.g., active chord sequences, tempo, genre preferences) and live MIDI input to make rapid choices about chord progressions, rhythm variations, scale adjustments, and structural shifts.

## Architecture & Tech Stack
* Audio Engine: Strudel.cc (WebAudio + TidalCycles pattern engine for JavaScript).

* Decision Engine: TypeSafe AI Jev API via the @typesafe-ai/sdk (or direct HTTP endpoints).

* Input Controllers: Web MIDI API (navigator.requestMIDIAccess) for live controller/keyboard input.

* Frontend Environment: React / Next.js or vanilla Vite + TypeScript.

## Key Concepts for Copilot
1. Jev Priming & Response Model:
Jev evaluates structured choices using three primary primitives:

* `choice`: Pick from a defined list of options with returned probabilities.

* `score`: Rank inputs against ordered levels on a scale.

* `noul`: Evaluate boolean truth statements (`yes`/`no`) with confidence scores.

Never ask Jev for free-form text or raw code generation. Always pass a discrete list of valid options or categories so software can execute the decision immediately in Strudel.

2. Strudel Pattern State:
Strudel patterns are expressed as functional chains, e.g., `s("bd hh sn hh").note("c3 e3 g3")`. Updates from Jev should modify pattern parameters dynamically using Strudel controls (e.g., `.bank()`, `.gain()`, `.speed()`, `.scale()`, `.struct()`).

## Core Workflows
1. Live MIDI Event Handling
Listen to incoming MIDI messages (Note On, CC, Velocity) and buffer short musical snapshots (e.g., last 4 bars played or current pitch class set).

```TypeScript
// src/midi/midiHandler.ts
export function setupMIDI(onNoteEvent: (notes: number[]) => void) {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then((access) => {
      for (const input of access.inputs.values()) {
        input.onmidimessage = (event) => {
          const [status, note, velocity] = event.data;
          // Handle note-on events
          if ((status & 0xf0) === 0x90 && velocity > 0) {
            // Buffer note and trigger update evaluation
          }
        };
      }
    });
  }
}
```
2. Jev Decision Calls
Use Jev to evaluate what musical direction the jam should take based on user state and MIDI activity.

```TypeScript
// src/ai/jevEngine.ts
import { TypeSafe } from '@typesafe-ai/sdk';

const client = new TypeSafe({ apiKey: process.env.TYPESAFE_API_KEY });

export async function decideNextProgression(currentGenre: string, userMidiNotes: number[]) {
  // Use Jev Choice primitive to select the best harmonic response
  const decision = await client.jev.choice({
    context: `Current genre: ${currentGenre}. User is playing MIDI notes: ${userMidiNotes.join(', ')}.`,
    options: [
      { id: 'subdominant', description: 'Move to IV chord to build stability' },
      { id: 'dominant', description: 'Move to V chord for tension' },
      { id: 'relative_minor', description: 'Shift to vi chord for color' },
      { id: 'chromatic_mediant', description: 'Surprise shift to flat-VI for high energy' }
    ]
  });

  // Returns highest probability option along with calibrated confidence score
  return decision;
}
```
3. Strudel Engine Integration
Map Jev decisions directly into Strudel pattern strings or active control state without rebuilding the entire audio graph.

```TypeScript
// src/audio/strudelPlayer.ts
import { evaluate, controls } from '@strudel/web';

const progressions: Record<string, string> = {
  subdominant: 'c3 e3 g3, f3 a3 c4',
  dominant: 'c3 e3 g3, g3 b3 d4',
  relative_minor: 'c3 e3 g3, a2 c3 e3',
  chromatic_mediant: 'c3 e3 g3, ab2 c3 eb3'
};

export function applyJevDecision(decisionId: string) {
  const notes = progressions[decisionId] || progressions.subdominant;
  // Update Strudel live pattern
  evaluate(`n("${notes}").s("sawtooth").lpf(800)`);
}
```
## Instructions for GitHub Copilot
When helping generate code in this repository:

1. Never use standard LLM text prompts for AI decisions. Always structure AI calls using Jev's choice, score, or noul interfaces.

2. Ensure all MIDI inputs update an internal state object (containing tempo, active notes, velocity variance) before passing context to Jev.

3. Keep Strudel pattern manipulations modular. Separate Strudel string evaluation (@strudel/web) from the state machine logic.

4. Ensure Jev API keys are loaded securely from environment variables (TYPESAFE_API_KEY) and calls are executed with low latency (<200ms target).