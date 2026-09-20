import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  arps,
  buildPattern,
  defaultSelection,
  findHarmony,
  findPalette,
  harmonies,
  keys,
  palettes,
  rhythms,
  STYLE_PALETTES,
  type Selection,
} from './domain/music'
import { createStrudelPlayer } from './audio/strudelPlayer'
import { createLiveVoice } from './audio/liveVoice'
import { requestDecision, type DecisionRequest } from './ai/jevEngine'
import {
  createMidiController,
  createMidiSnapshot,
  noteName,
  type MidiNoteEvent,
  type MidiSnapshot,
  type MidiState,
} from './midi/midiHandler'

const styleNames = Object.keys(STYLE_PALETTES)
const JEV_INTERVAL_MS = 8000

const describe = (error: unknown, fallbackText: string) =>
  error instanceof Error ? error.message : fallbackText

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [style, setStyle] = useState(styleNames[0])
  const [selection, setSelection] = useState<Selection>(defaultSelection)
  const [notice, setNotice] = useState<string | null>(null)
  const [directionSource, setDirectionSource] = useState<'local' | 'jev'>('local')
  const [confidence, setConfidence] = useState<number | null>(null)
  // Jev never overrides a dimension the player has pinned by hand.
  const [pinned, setPinned] = useState({ harmony: false, rhythm: false })
  const [player] = useState(createStrudelPlayer)
  // Live keyboard monitoring and whether the audio engine has been unlocked.
  const [keysThrough, setKeysThrough] = useState(true)
  const [audioReady, setAudioReady] = useState(false)

  const [midiState, setMidiState] = useState<MidiState>({
    status: 'idle',
    devices: [],
    message: 'Not connected yet',
  })
  const [snapshot, setSnapshot] = useState<MidiSnapshot>(createMidiSnapshot)

  // Raw MIDI traffic is far too chatty to render; only real musical changes pass through.
  const applySnapshot = useCallback((next: MidiSnapshot) => {
    setSnapshot((current) => (
      current.activeNotes.join() === next.activeNotes.join()
      && current.lastControl?.value === next.lastControl?.value
        ? current
        : next
    ))
  }, [])

  const [liveVoice] = useState(() => createLiveVoice(findPalette(defaultSelection.palette).keys))

  // Without this the keyboard is only tracked; with it, keys sound through Strudel.
  const notesThrough = useCallback((event: MidiNoteEvent) => {
    if (event.kind === 'noteOn') liveVoice.strike(event.note, event.velocity)
    else liveVoice.release(event.note)
  }, [liveVoice])

  const [midi] = useState(() => createMidiController(setMidiState, applySnapshot, notesThrough))

  const plan = useMemo(() => buildPattern(selection), [selection])
  const appliedCode = useRef<string | null>(null)
  const pending = useRef(false)
  const pinnedRef = useRef(pinned)

  const setPin = (dimension: 'harmony' | 'rhythm', value: boolean) => {
    pinnedRef.current = { ...pinnedRef.current, [dimension]: value }
    setPinned(pinnedRef.current)
  }
  const context = useRef<DecisionRequest>({
    style: styleNames[0],
    key: defaultSelection.key,
    tempo: defaultSelection.tempo,
    midi: createMidiSnapshot(),
  })

  useEffect(() => {
    context.current = { style, key: selection.key, tempo: selection.tempo, midi: snapshot }
  }, [style, selection.key, selection.tempo, snapshot])

  useEffect(() => () => midi.disconnect(), [midi])
  useEffect(() => () => liveVoice.allNotesOff(), [liveVoice])

  // Keep the live voice and the key-monitoring switch in sync with the UI.
  useEffect(() => {
    liveVoice.setVoice(findPalette(selection.palette).keys)
  }, [liveVoice, selection.palette])

  useEffect(() => {
    liveVoice.setEnabled(keysThrough)
  }, [liveVoice, keysThrough])

  // Re-evaluate only when the generated program actually changes.
  useEffect(() => {
    if (!isPlaying || appliedCode.current === plan.code) return
    appliedCode.current = plan.code
    player.applyDecision(plan).catch((error: unknown) => setNotice(describe(error, 'Could not update the pattern')))
  }, [isPlaying, plan, player])

  const askJev = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    try {
      const response = await requestDecision(context.current)
      const held = pinnedRef.current
      setSelection((current) => ({
        ...current,
        ...(held.harmony ? {} : { harmony: response.harmony }),
        ...(held.rhythm ? {} : { rhythm: response.rhythm }),
      }))
      setDirectionSource(held.harmony && held.rhythm ? 'local' : 'jev')
      setConfidence(response.confidence)
      setNotice(null)
    } catch {
      setNotice('Jev is unreachable - holding the current direction')
    } finally {
      pending.current = false
    }
  }, [])

  // Continuous listening: ask again every few bars while the jam runs.
  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => { void askJev() }, JEV_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isPlaying, askJev])

  const toggleSession = async () => {
    setNotice(null)
    if (isPlaying) {
      player.stop()
      appliedCode.current = null
      setIsPlaying(false)
      return
    }

    try {
      // Runs inside the click handler so the AudioContext is allowed to resume.
      await player.start(plan)
      appliedCode.current = plan.code
      setIsPlaying(true)
      setAudioReady(true)
    } catch (error) {
      setNotice(describe(error, 'Audio could not start'))
      return
    }

    if (midiState.status === 'idle') void midi.connect()
    await askJev()
  }

  const update = (patch: Partial<Selection>) => setSelection((current) => ({ ...current, ...patch }))

  const chooseStyle = (nextStyle: string) => {
    setStyle(nextStyle)
    const palette = STYLE_PALETTES[nextStyle]
    if (palette) update({ palette })
  }

  // Clicking the active option toggles its pin, so control can be handed back to Jev.
  const chooseHarmony = (nextHarmony: Selection['harmony']) => {
    setPin('harmony', nextHarmony === selection.harmony ? !pinned.harmony : true)
    setDirectionSource('local')
    setConfidence(null)
    update({ harmony: nextHarmony })
  }

  const chooseRhythm = (nextRhythm: Selection['rhythm']) => {
    setPin('rhythm', nextRhythm === selection.rhythm ? !pinned.rhythm : true)
    setDirectionSource('local')
    update({ rhythm: nextRhythm })
  }

  const harmony = findHarmony(selection.harmony)
  const heard = snapshot.activeNotes.map(noteName)

  // Audition the live voice without a keyboard attached: four notes, then release.
  const audition = () => {
    if (!audioReady) {
      setNotice('Press Start first - browsers only run audio after a click.')
      return
    }
    const notes = [60, 64, 67, 72]
    notes.forEach((note, index) => {
      window.setTimeout(() => liveVoice.strike(note, 96), index * 110)
    })
    window.setTimeout(() => notes.forEach((note) => liveVoice.release(note)), 1100)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="wordmark"><span className="signal-dot" />JEV / STRUDEL</div>
        <div className="session-state"><span className={isPlaying ? 'live-dot' : 'idle-dot'} />{isPlaying ? 'JAM IN PROGRESS' : 'READY TO LISTEN'}</div>
      </header>

      <section className="intro">
        <p className="eyebrow">A responsive musical second mind</p>
        <h1>Make a little<br /><em>room for surprise.</em></h1>
        <p className="lede">Set the atmosphere, play a phrase, and let Jev choose where the next bar wants to go.</p>
      </section>

      <section className="workspace" aria-label="Jam controls">
        <aside className="control-rail">
          <div className="rail-heading"><span>01</span><h2>Session</h2></div>
          <label>Style<select value={style} onChange={(event) => chooseStyle(event.target.value)}>{styleNames.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label>Key<select value={selection.key} onChange={(event) => update({ key: event.target.value as Selection['key'] })}>{keys.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label>Tempo <output>{selection.tempo} BPM</output><input type="range" min="70" max="150" value={selection.tempo} onChange={(event) => update({ tempo: Number(event.target.value) })} /></label>
          <button className={isPlaying ? 'transport active' : 'transport'} type="button" onClick={toggleSession}><span>{isPlaying ? '■' : '▶'}</span>{isPlaying ? 'Stop the session' : 'Start the session'}</button>
          {notice && <p className="error-status">{notice}</p>}

          <div className="rail-heading"><span>02</span><h2>MIDI input</h2></div>
          <p className={`midi-status midi-${midiState.status}`}>{midiState.message}</p>
          {midiState.devices.length > 0 && <ul className="device-list">{midiState.devices.map((device) => <li key={device.id}>{device.name}</li>)}</ul>}
          <p className="heard"><span>heard notes</span><strong>{heard.length ? heard.join(' ') : '—'}</strong></p>
          {snapshot.lastControl && <p className="heard"><span>last control</span><strong>CC{snapshot.lastControl.controller} · {snapshot.lastControl.value}</strong></p>}
          <div className="voice-row">
            <label className="switch">
              <input type="checkbox" checked={keysThrough} onChange={(event) => setKeysThrough(event.target.checked)} />
              <span>Play my keys</span>
            </label>
            <button className="ghost" type="button" onClick={audition}>Audition</button>
          </div>
          {!audioReady && <p className="hint">Press Start once to unlock audio. After that your keys sound even when the jam is stopped.</p>}
          <button className="ghost" type="button" onClick={() => void midi.connect()}>{midiState.status === 'idle' ? 'Connect MIDI' : 'Rescan MIDI'}</button>
        </aside>

        <div className="decision-stage">
          <div className="stage-heading">
            <div>
              <span className="eyebrow">{directionSource === 'jev' ? 'Jev chose' : 'Your call'} · {plan.chordLabel}{pinned.harmony && <em className="pin-tag">pinned</em>}</span>
              <h2>{harmony.label}</h2>
            </div>
            <span className="bar-count">{confidence === null ? 'LOCAL' : `CONFIDENCE ${confidence.toFixed(2)}`}</span>
          </div>

          <div className="now-playing">
            {plan.layers.map((layer) => (
              <div className="layer" key={layer.name}>
                <span className="layer-name">{layer.name}</span>
                <span className="layer-detail">{layer.detail}</span>
                <code className="layer-notes">{layer.notes}</code>
              </div>
            ))}
          </div>

          <div className="decision-list">
            {harmonies.map((option, index) => (
              <button className={selection.harmony === option.id ? 'decision selected' : 'decision'} type="button" key={option.id} onClick={() => chooseHarmony(option.id)}>
                <span className="decision-index">0{index + 1}</span>
                <span className="decision-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                <span className="decision-mark" style={{ backgroundColor: option.color }} />
              </button>
            ))}
          </div>
          <p className="hint">Click a direction or rhythm to pin it; click the active one again to hand it back to Jev.</p>
        </div>
      </section>

      <section className="shaping" aria-label="Sound shaping">
        <div className="pill-group">
          <h3>Arpeggiation</h3>
          {arps.map((option) => (
            <button className={selection.arp === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => update({ arp: option.id })}>
              <strong>{option.label}</strong><small>{option.description}</small>
            </button>
          ))}
        </div>
        <div className="pill-group">
          <h3>Rhythm{pinned.rhythm && <em className="pin-tag">pinned</em>}</h3>
          {rhythms.map((option) => (
            <button className={selection.rhythm === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => chooseRhythm(option.id)}>
              <strong>{option.label}</strong><small>{option.description}</small>
            </button>
          ))}
        </div>
        <div className="pill-group">
          <h3>Instrument</h3>
          {palettes.map((option) => (
            <button className={selection.palette === option.id ? 'pill active' : 'pill'} type="button" key={option.id} onClick={() => update({ palette: option.id })}>
              <strong>{option.label}</strong><small>{option.description}</small>
            </button>
          ))}
        </div>
      </section>

      <details className="source">
        <summary>What is playing right now</summary>
        <pre>{plan.code}</pre>
      </details>

      <footer><span>SNAPSHOT <strong>{selection.key}</strong> · {selection.tempo} BPM</span><span>{isPlaying ? 'STRUDEL RUNNING' : 'AUDIO ENGINE IDLE'}</span><span>SESSION 0001</span></footer>
    </main>
  )
}

export default App
