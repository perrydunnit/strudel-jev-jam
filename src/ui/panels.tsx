/**
 * The three panels of the app, as pure presentation.
 *
 * They hold no state and make no decisions: everything they show arrives as props, and
 * everything they can do arrives as a callback. That is what lets the app shell be about
 * wiring and this file be about layout, and it is why a change to the look of the control
 * rail cannot affect what the music does.
 *
 * Each panel takes a `state` and an `actions` object rather than a dozen positional props.
 */
import { findInstrument } from '../domain/samples'
import { arps, rhythms } from '../domain/figures'
import { chordSymbol, firstChord, keys } from '../domain/chords'
import { findSequence, findStyle, styles } from '../domain/styles'
import type { PatternPlan } from '../domain/pattern'
import { chordModes, LAYER_ORBITS, type LayerId, type Selection, type SequenceId, type Style } from '../domain/vocabulary'
import type { StrudelPlayer } from '../audio/strudelPlayer'
import { LEAD_LEVEL_RANGE } from '../audio/liveVoice'
import { noteName, type MidiSnapshot, type MidiState } from '../midi/midiHandler'
import type { DecisionResponse } from '../ai/jevEngine'
import type { Mixer } from './useMixer'
import { VOICE_VIEWS } from './views'
import { VoiceCanvas } from './VoiceCanvas'

const clampNote = (value: string) => Math.max(0, Math.min(127, Number(value) || 0))

/** Highest-probability options, for showing what the model weighed. */
const topOptions = (probabilities: DecisionResponse['sequenceProbabilities']): string[] =>
  Object.entries(probabilities)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([id, probability]) => `${id.split('/').pop()} ${Math.round(probability * 100)}%`)

export type SessionState = {
  selection: Selection
  isPlaying: boolean
  notice: string | null
  midi: MidiState
  snapshot: MidiSnapshot
  preloaded: number
  backing: number
  leadLevel: number
  keysThrough: boolean
  audioReady: boolean
  jevEnabled: boolean
}

export type SessionActions = {
  chooseStyle: (id: Selection['style']) => void
  update: (patch: Partial<Selection>) => void
  toggleSession: () => void
  setLeadLevel: (level: number) => void
  setKeysThrough: (through: boolean) => void
  toggleJev: (next: boolean) => void
  connectMidi: () => void
  audition: () => void
}

export function ControlRail({ state, actions }: { state: SessionState; actions: SessionActions }) {
  const { selection, midi, snapshot } = state
  const heard = snapshot.activeNotes.map(noteName)

  return (
    <aside className="control-rail">
      <div className="rail-heading"><span>01</span><h2>Session</h2></div>
      <label>Style<select value={selection.style} onChange={(event) => actions.chooseStyle(event.target.value as Selection['style'])}>{styles.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <p className="style-note">{findStyle(selection.style).description}</p>
      <label>Key<select value={selection.key} onChange={(event) => actions.update({ key: event.target.value as Selection['key'] })}>{keys.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Tempo <output>{selection.tempo} BPM</output><input type="range" min="70" max="150" value={selection.tempo} onChange={(event) => actions.update({ tempo: Number(event.target.value) })} /></label>
      <button className={state.isPlaying ? 'transport active' : 'transport'} type="button" onClick={actions.toggleSession}><span>{state.isPlaying ? '■' : '▶'}</span>{state.isPlaying ? 'Stop the session' : 'Start the session'}</button>
      {state.notice && <p className="error-status">{state.notice}</p>}

      <div className="rail-heading"><span>02</span><h2>MIDI input</h2></div>
      <p className={`midi-status midi-${midi.status}`}>{midi.message}</p>
      {midi.devices.length > 0 && <ul className="device-list">{midi.devices.map((device) => <li key={device.id}>{device.name}</li>)}</ul>}
      <p className="heard"><span>heard notes</span><strong>{heard.length ? heard.join(' ') : '—'}</strong></p>
      {snapshot.lastControl && <p className="heard"><span>last control</span><strong>CC{snapshot.lastControl.controller} · {snapshot.lastControl.value}</strong></p>}
      <div className="range-row">
        <label>Keys from<input type="number" min="0" max="127" value={selection.soloLow} onChange={(event) => actions.update({ soloLow: clampNote(event.target.value) })} /><small>{noteName(selection.soloLow)}</small></label>
        <label>to<input type="number" min="0" max="127" value={selection.soloHigh} onChange={(event) => actions.update({ soloHigh: clampNote(event.target.value) })} /><small>{noteName(selection.soloHigh)}</small></label>
      </div>
      {state.preloaded > 0 && <p className="heard"><span>prepared</span><strong>{state.preloaded} solo · {state.backing} backing · {findInstrument(selection.solo).label}</strong></p>}
      <label className="lead-level">
        Lead level<output>{state.leadLevel.toFixed(2)}x</output>
        <input type="range" min={LEAD_LEVEL_RANGE.min} max={LEAD_LEVEL_RANGE.max} step={LEAD_LEVEL_RANGE.step} value={state.leadLevel} onChange={(event) => actions.setLeadLevel(Number(event.target.value))} />
      </label>
      <div className="voice-row">
        <label className="switch">
          <input type="checkbox" checked={state.keysThrough} onChange={(event) => actions.setKeysThrough(event.target.checked)} />
          <span>Play my keys</span>
        </label>
        <button className="ghost" type="button" onClick={actions.audition}>Audition</button>
      </div>
      {!state.audioReady && <p className="hint">Press Start once to unlock audio. After that your keys sound even when the jam is stopped.</p>}
      <button className="ghost" type="button" onClick={actions.connectMidi}>{midi.status === 'idle' ? 'Connect MIDI' : 'Rescan MIDI'}</button>

      <div className="rail-heading"><span>03</span><h2>Jev</h2></div>
      <label className="switch">
        <input type="checkbox" checked={state.jevEnabled} onChange={(event) => actions.toggleJev(event.target.checked)} />
        <span>Ask Jev for changes</span>
      </label>
      <p className="hint">Jev proposes the phrase to play next, one bar before the end, and the answer lands on the bar line. With this off nothing is sent: the phrase repeats and only your own choices move it. Picking a phrase by hand still works, and pinning was never Jev's to overrule.</p>
    </aside>
  )
}

export type StageState = {
  plan: PatternPlan
  barIndex: number
  pendingSequence: SequenceId | null
  directionSource: 'local' | 'jev'
  jevEnabled: boolean
  pinned: { sequence: boolean; rhythm: boolean }
  lastDecision: DecisionResponse | null
  selection: Selection
  style: Style
  heard: string[]
  isPlaying: boolean
  player: StrudelPlayer
  mixer: Mixer
}

export type StageActions = {
  chooseSequence: (id: SequenceId) => void
}

/** One mute and one solo button per part. Muting the keys part silences the live voice. */
function PartControls({ id, name, mixer }: { id: LayerId; name: string; mixer: Mixer }) {
  const muted = mixer.muted.includes(id)
  const soloed = mixer.soloed.includes(id)
  return (
    <span className="layer-actions">
      <button
        className={muted ? 'layer-button muted' : 'layer-button'}
        type="button"
        aria-pressed={muted}
        title={muted ? `Unmute ${name}` : `Mute ${name}`}
        onClick={() => mixer.toggleMute(id)}
      >
        M
      </button>
      <button
        className={soloed ? 'layer-button soloed' : 'layer-button'}
        type="button"
        aria-pressed={soloed}
        title={soloed ? `Stop hearing ${name} alone` : `Hear ${name} alone`}
        onClick={() => mixer.toggleSolo(id)}
      >
        S
      </button>
    </span>
  )
}

export function DecisionStage({ state, actions }: { state: StageState; actions: StageActions }) {
  const { plan, barIndex, pendingSequence, directionSource, jevEnabled, pinned, lastDecision, selection, style, heard, isPlaying, player, mixer } = state
  const eyebrow = pendingSequence
    ? `Queued \u00b7 ${findSequence(selection.style, pendingSequence).label} takes over at the end of this phrase`
    : `${!jevEnabled ? 'Jev paused' : directionSource === 'jev' ? 'Jev chose' : 'Your call'} \u00b7 ${plan.sequenceLabel}`

  return (
    <div className="decision-stage">
      <div className="stage-heading">
        <div>
          <span className="eyebrow">
            {eyebrow}
            {pinned.sequence && <em className="pin-tag">pinned</em>}
          </span>
          <h2>Bar {barIndex + 1} of {plan.bars.length} · {plan.bars[barIndex]?.chordLabel}</h2>
        </div>
        <span className="bar-count">{lastDecision ? `NEXT ${lastDecision.sequenceConfidence.toFixed(2)} · RHYTHM ${lastDecision.rhythmConfidence.toFixed(2)}` : 'LOCAL'}</span>
      </div>

      <div className="bar-strip">
        {plan.bars.map((bar, index) => (
          <span className={index === barIndex ? 'bar-chip active' : 'bar-chip'} key={`${index}-${bar.chordLabel}`}>
            <small>{index + 1}</small><strong>{bar.chordLabel}</strong>
          </span>
        ))}
      </div>

      <div className="now-playing">
        {plan.layers.map((layer) => (
          <div className={mixer.audible(layer.id) ? 'layer' : 'layer silenced'} key={layer.id}>
            <span className="layer-name">{layer.name}</span>
            <span className="layer-detail">{layer.detail}</span>
            <code className="layer-notes"><b>{layer.id}</b> {layer.notes}</code>
            <VoiceCanvas view={VOICE_VIEWS[layer.id]} orbit={LAYER_ORBITS[layer.id as Exclude<LayerId, 'solo'>]} player={player} playing={isPlaying} />
            <PartControls id={layer.id} name={layer.name} mixer={mixer} />
          </div>
        ))}
        <div className={mixer.audible('solo') ? 'layer' : 'layer silenced'}>
          <span className="layer-name">Solo</span>
          <span className="layer-detail">live keys · {findInstrument(selection.solo).label}</span>
          <code className="layer-notes"><b>keys</b> {heard.length ? heard.join(' ') : 'plays your MIDI input'}</code>
          <VoiceCanvas view={VOICE_VIEWS.solo} player={player} playing={isPlaying} />
          <PartControls id="solo" name="Solo" mixer={mixer} />
        </div>
      </div>
      <p className="hint">M silences a part, S hears it alone; with any part soloed the rest are out. Both are gain changes on the part's own bus, so they take effect on the note that is already ringing and leave the phrase running - and <em>Solo</em> here means the keys you play, not the instrument.</p>

      <div className="decision-list">
        {style.sequences.map((option, index) => (
          <button
            className={selection.sequence === option.id ? 'decision selected' : pendingSequence === option.id ? 'decision queued' : 'decision'}
            type="button"
            key={option.id}
            onClick={() => actions.chooseSequence(option.id)}
          >
            <span className="decision-index">0{index + 1}</span>
            <span className="decision-copy"><strong>{option.label}</strong><small>opens on {chordSymbol(firstChord(option), selection.key)} \u00b7 {option.effect}</small></span>
            <span className="decision-mark" style={{ backgroundColor: firstChord(option).color }} />
          </button>
        ))}
      </div>
      <p className="hint">{style.label} owns these {style.sequences.length} phrases and nothing outside them. One bar before the end, code proposes the next chords and Jev picks by vibe. Choosing a phrase yourself takes over at the end of the one playing, never mid-phrase - the strip keeps showing what you are hearing until then. Click it again to hand control back to Jev.</p>
      {lastDecision && (
        <p className="decision-note">
          Jev ranked {topOptions(lastDecision.sequenceProbabilities).join(' · ')}
          {lastDecision.model ? ` · ${lastDecision.model}` : ''}
          {lastDecision.usage ? ` · ${lastDecision.usage.input_tokens + lastDecision.usage.output_tokens} tokens` : ''}
          <br />
          Candidates are generated and validated in code from this style's own phrases, scored by how each opening chord continues the chords just played. Confidence is how concentrated each answer was: {lastDecision.sequenceConfidence.toFixed(2)} on the next chord and {lastDecision.rhythmConfidence.toFixed(2)} on the rhythm. A flat split is normal for a taste decision and does not block it.
        </p>
      )}
    </div>
  )
}

export type ShapingProps = {
  selection: Selection
  styleLabel: string
  solos: ReturnType<typeof findInstrument>[]
  rhythmPinned: boolean
  update: (patch: Partial<Selection>) => void
  chooseRhythm: (id: Selection['rhythm']) => void
}

export function Shaping({ selection, styleLabel, solos, rhythmPinned, update, chooseRhythm }: ShapingProps) {
  return (
    <section className="shaping" aria-label="Sound shaping">
      <div className="pill-group">
        <h3>Chords</h3>
        {chordModes.map((option) => (
          <button className={selection.chordMode === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => update({ chordMode: option.id })}>
            <strong>{option.label}</strong><small>{option.description}</small>
          </button>
        ))}
      </div>
      <div className="pill-group">
        <h3>Figure</h3>
        {arps.map((option) => (
          <button className={selection.arp === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => update({ arp: option.id })}>
            <strong>{option.label}</strong><small>{option.description}</small>
          </button>
        ))}
      </div>
      <div className="pill-group">
        <h3>Rhythm{rhythmPinned && <em className="pin-tag">pinned</em>}</h3>
        {rhythms.map((option) => (
          <button className={selection.rhythm === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => chooseRhythm(option.id)}>
            <strong>{option.label}</strong><small>{option.description}</small>
          </button>
        ))}
      </div>
      <div className="pill-group">
        <h3>Solo instrument<em className="pin-tag">{styleLabel} only</em></h3>
        {solos.map((option) => (
          <button className={selection.solo === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => update({ solo: option.id })}>
            <strong>{option.label}</strong><small>{option.group} · {option.description}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
