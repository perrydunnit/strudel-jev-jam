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
import { findSequence, findStyle, homeSequence, chartSections, styles } from '../domain/styles'
import { chordModes, LAYER_ORBITS, TEMPO_RANGE, type LayerId, type Selection, type SequenceId, type Style } from '../domain/vocabulary'
import { HOLD_FORMS } from '../domain/harmony'
import type { PatternPlan } from '../domain/pattern'
import type { StrudelPlayer } from '../audio/strudelPlayer'
import { DEFAULT_LEAD_LEVEL, LEAD_LEVEL_RANGE } from '../audio/liveVoice'
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
  keysThrough: boolean
  audioReady: boolean
  jevEnabled: boolean
}

export type SessionActions = {
  chooseStyle: (id: Selection['style']) => void
  update: (patch: Partial<Selection>) => void
  toggleSession: () => void
  setKeysThrough: (through: boolean) => void
  toggleJev: (next: boolean) => void
  connectMidi: () => void
  audition: () => void
}

export function ControlRail({ state, actions }: { state: SessionState; actions: SessionActions }) {
  const { selection, midi, snapshot } = state
  const heard = snapshot.activeNotes.map(noteName)
  const style = findStyle(selection.style)
  // The tempo is the style's until the player moves it, and the only evidence needed is that it no
  // longer matches. Dragging the slider back onto the style's own tempo hands it back.
  const tempoPinned = selection.tempo !== style.tempo

  return (
    <aside className="control-rail">
      <div className="rail-heading"><span>01</span><h2>Session</h2></div>
      <label>Style<select value={selection.style} onChange={(event) => actions.chooseStyle(event.target.value as Selection['style'])}>{styles.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <p className="style-note">{style.description}</p>
      <label>Key<select value={selection.key} onChange={(event) => actions.update({ key: event.target.value as Selection['key'] })}>{keys.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Tempo <output>{selection.tempo} BPM</output>{tempoPinned && <em className="pin-tag">pinned</em>}<input type="range" min={TEMPO_RANGE.min} max={TEMPO_RANGE.max} value={selection.tempo} onChange={(event) => actions.update({ tempo: Number(event.target.value) })} /></label>
      {tempoPinned && <p className="style-note">{style.label} is written for {style.tempo} BPM, and a style change will keep your tempo until you set it back.</p>}
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
  /** How many times in a row the phrase has already come round, so the stage can say so. */
  heldCount: number
  /** The live voice's own level, which is a compressor chain rather than a bus gain. */
  leadLevel: number
  selection: Selection
  style: Style
  heard: string[]
  isPlaying: boolean
  player: StrudelPlayer
  mixer: Mixer
}

export type StageActions = {
  chooseSequence: (id: SequenceId) => void
  setLeadLevel: (level: number) => void
}

/** One mute and one solo button, and one level control, per part. Muting the keys part silences the live voice. */
function PartControls({
  id,
  name,
  mixer,
  lead,
}: {
  id: LayerId
  name: string
  mixer: Mixer
  lead?: { level: number; set: (level: number) => void }
}) {
  const muted = mixer.muted.includes(id)
  const soloed = mixer.soloed.includes(id)
  // The keys are the one part the mixer does not route: their level is the lead control, which runs
  // a compressor chain rather than a bus gain and is stored with the instrument, so it arrives here
  // as its own control rather than as a mixer trim.
  const mixable = id === 'solo' ? undefined : id
  const level = mixable ? mixer.levels[mixable] : lead?.level ?? 1
  // The trim is "off its default" for the pattern layers and for the keys alike, so the same green
  // means the same thing in every row.
  const off = mixable ? level !== 1 : lead !== undefined && lead.level !== DEFAULT_LEAD_LEVEL
  return (
    <span className="layer-actions">
      <span className="layer-switches">
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
      {mixable && (
        <input
          className={off ? 'level-slider trimmed' : 'level-slider'}
          type="range"
          min={0}
          max={150}
          step={5}
          value={Math.round(level * 100)}
          aria-label={`${name} level`}
          title={`${name} level ${Math.round(level * 100)}% of what its style is written with`}
          onChange={(event) => mixer.setLevel(mixable, Number(event.target.value) / 100)}
        />
      )}
      {lead && (
        <input
          className={off ? 'level-slider trimmed' : 'level-slider'}
          type="range"
          min={LEAD_LEVEL_RANGE.min}
          max={LEAD_LEVEL_RANGE.max}
          step={LEAD_LEVEL_RANGE.step}
          value={lead.level}
          aria-label={`${name} level`}
          title={`${name} level ${lead.level.toFixed(2)}x`}
          onChange={(event) => lead.set(Number(event.target.value))}
        />
      )}
    </span>
  )
}

export function DecisionStage({ state, actions }: { state: StageState; actions: StageActions }) {
  const { plan, barIndex, pendingSequence, directionSource, jevEnabled, pinned, lastDecision, heldCount, selection, style, heard, isPlaying, player, mixer, leadLevel } = state
  const held = heldCount + 1
  const home = homeSequence(style).id
  // The form is what the player is committed to, so the strip shows all of it, in rows of one
  // section each, with where they are in it. The rows are as long as the sections are - a twelve-bar
  // blues gets a twelve-bar row - so the strip is the form rather than a grid it was poured into.
  const lengths = plan.sectionBars
  const starts = lengths.reduce<number[]>((ends, count) => [...ends, ends[ends.length - 1] + count], [0])
  const sections = lengths.map((_, index) => plan.bars.slice(starts[index], starts[index + 1]))
  const playing = lengths.findIndex((_, index) => barIndex < starts[index + 1])
  const at = playing === -1 ? Math.max(0, lengths.length - 1) : playing
  const eyebrow = pendingSequence
    ? `Queued \u00b7 ${findSequence(selection.style, pendingSequence).label} takes over at the end of this phrase`
    : `${!jevEnabled ? 'Jev paused' : pinned.sequence ? 'Your call' : directionSource === 'jev' ? 'Jev chose' : 'Holding'} · ${plan.sequenceLabel} · ${held === 1 ? 'first pass' : `pass ${held}`}`

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
        {sections.map((group, groupIndex) => (
          <div
            className={groupIndex === at ? 'bar-row active' : 'bar-row'}
            key={`section-${groupIndex}`}
            style={{ gridTemplateColumns: `18px repeat(${group.length}, minmax(0, 1fr))` }}
          >
            <span className="bar-row-label">{groupIndex + 1}</span>
            {group.map((bar, offset) => {
              const index = starts[groupIndex] + offset
              const state = index === barIndex ? 'bar-chip active' : index < barIndex ? 'bar-chip played' : 'bar-chip'
              return (
                <span className={state} key={`${index}-${bar.chordLabel}`}>
                  <small>{index + 1}</small><strong>{bar.chordLabel}</strong>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <div className="now-playing">
        {plan.layers.map((layer) => (
          <div className={mixer.audible(layer.id) ? 'layer' : 'layer silenced'} key={layer.id}>
            <span className="layer-name">{layer.name}</span>
            <span className="layer-detail">{layer.detail}</span>
            <code className="layer-notes"><b>{layer.id}</b> {layer.sectionNotes[at] ?? layer.notes}</code>
            <VoiceCanvas view={VOICE_VIEWS[layer.id]} orbit={LAYER_ORBITS[layer.id as Exclude<LayerId, 'solo'>]} player={player} playing={isPlaying} />
            <PartControls id={layer.id} name={layer.name} mixer={mixer} />
          </div>
        ))}
        <div className={mixer.audible('solo') ? 'layer' : 'layer silenced'}>
          <span className="layer-name">Solo</span>
          <span className="layer-detail">live keys · {findInstrument(selection.solo).label}</span>
          <code className="layer-notes"><b>keys</b> {heard.length ? heard.join(' ') : 'plays your MIDI input'}</code>
          <VoiceCanvas view={VOICE_VIEWS.solo} player={player} playing={isPlaying} />
          <PartControls id="solo" name="Solo" mixer={mixer} lead={{ level: leadLevel, set: actions.setLeadLevel }} />
        </div>
      </div>
      <div className="mixer-note">
        <p className="hint">M silences a part and S hears it alone, in the part's own row; the slider under them trims that part against the balance its style is written with, and turns green when it is off it. All of them are gain changes on the part's own bus, so they take effect on the note that is already ringing and leave the phrase running - and <em>Solo</em> here means the keys you play, not the instrument.</p>
        {mixer.trimmed && <button className="ghost" type="button" onClick={mixer.resetLevels}>Reset levels</button>}
      </div>

      <div className="decision-list">
        {style.sequences.map((option, index) => (
          <button
            className={selection.sequence === option.id ? 'decision selected' : pendingSequence === option.id ? 'decision queued' : 'decision'}
            type="button"
            key={option.id}
            onClick={() => actions.chooseSequence(option.id)}
          >
            <span className="decision-index">0{index + 1}</span>
            <span className="decision-copy"><strong>{option.label}</strong>{home === option.id && <em className="home-tag">home</em>}<small>opens on {chordSymbol(firstChord(option), selection.key)} · {option.effect}</small><small className="decision-order">form · {chartSections(style, option.id).map((part) => part.label).join(' → ')}</small></span>
            <span className="decision-mark" style={{ backgroundColor: firstChord(option).color }} />
          </button>
        ))}
      </div>
      <p className="hint">{style.label} owns these {style.sequences.length} sections and nothing outside them, and plays them as one form of {plan.sectionBars.reduce((total, count) => total + count, 0)} bars that repeats. Sections are as long as the music needs - eight bars for a dance phrase, twelve for the blues - and each row of the strip above is one of them. The one marked <em className="home-tag">home</em> opens on the tonic, which is where a session starts and where a style change lands - leading from any other section is the same form entered further in. The form plays {HOLD_FORMS} times and then Jev leads the next one from a different section, so there is a stretch you can rely on and then a move. Clicking a section leads the next form from there - it takes over at the end of the one playing, never mid-form.</p>
      {lastDecision && (
        <p className="decision-note">
          Jev ranked {topOptions(lastDecision.sequenceProbabilities).join(' · ')}
          {lastDecision.model ? ` · ${lastDecision.model}` : ''}
          {lastDecision.usage ? ` · ${lastDecision.usage.input_tokens + lastDecision.usage.output_tokens} tokens` : ''}
          <br />
          Candidates are generated and validated in code from this style's own sections, and each option names the form it would lead. Confidence is how concentrated each answer was: {lastDecision.sequenceConfidence.toFixed(2)} on the form and {lastDecision.rhythmConfidence.toFixed(2)} on the rhythm. When the form moves is the schedule's decision, not the model's - asking a model whether to move just gets you "no" - so staying is not offered when a move is due and the answer is always a destination.
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
