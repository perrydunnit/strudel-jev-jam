import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { findInstrument } from './domain/samples'
import { defaultSelection, findStyle, homeSequence, chartSections } from './domain/styles'
import { buildPattern } from './domain/pattern'
import { type Handoff, type Selection } from './domain/vocabulary'
import { HOLD_FORMS, nextChordCandidates, sequenceChords } from './domain/harmony'
import { createStrudelPlayer } from './audio/strudelPlayer'
import { createLiveVoice } from './audio/liveVoice'
import { KEY_ANALYSER } from './audio/voiceViews'
import { requestDecision, type DecisionRequest, type DecisionResponse } from './ai/jevEngine'
import {
  createMidiController,
  createMidiSnapshot,
  noteName,
  type MidiNoteEvent,
  type MidiSnapshot,
  type MidiState,
} from './midi/midiHandler'
import { storedLeadLevel, storeLeadLevel } from './ui/leadLevel'
import { useMixer } from './ui/useMixer'
import { ControlRail, DecisionStage, Shaping } from './ui/panels'

const describe = (error: unknown, fallbackText: string) =>
  error instanceof Error ? error.message : fallbackText

/**
 * A phrase change that has been decided but has not arrived yet. The program carries it from
 * the moment it is known, so the switch happens on the bar line. `rhythm` rides along because
 * a rhythm change is decided with the phrase change and takes effect with it.
 */
type HandoffPlan = Handoff & { source: 'local' | 'jev'; rhythm?: Selection['rhythm'] }

/**
 * The app shell: it owns the session, wires the parts together, and lays out the panels.
 *
 * The parts it wires are separate concerns - the transport and its bar clock, the mixer, the
 * MIDI input, the live voice, and Jev's decisions - and each of those lives in its own hook or
 * module. What is left here is the coordination between them, which is the one job that
 * genuinely belongs to a shell.
 */
function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [selection, setSelection] = useState<Selection>(defaultSelection)
  const [notice, setNotice] = useState<string | null>(null)
  const [directionSource, setDirectionSource] = useState<'local' | 'jev'>('local')
  const [lastDecision, setLastDecision] = useState<DecisionResponse | null>(null)
  const [barIndex, setBarIndex] = useState(0)
  const [preloaded, setPreloaded] = useState(0)
  const [backing, setBacking] = useState(0)
  // Jev never overrides a dimension the player has pinned by hand.
  const [pinned, setPinned] = useState({ sequence: false, rhythm: false })
  const [jevEnabled, setJevEnabled] = useState(true)
  const [keysThrough, setKeysThrough] = useState(true)
  const [audioReady, setAudioReady] = useState(false)
  /** Level for the lead. Not part of `selection`, so moving it never rebuilds the pattern. */
  const [leadLevel, setLeadLevel] = useState<number>(storedLeadLevel)

  const mixer = useMixer()
  const [player] = useState(() => createStrudelPlayer(setNotice))

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

  const [liveVoice] = useState(() => createLiveVoice(defaultSelection.solo))

  // Without this the keyboard is only tracked; with it, keys sound through Strudel.
  const notesThrough = useCallback((event: MidiNoteEvent) => {
    if (event.kind === 'noteOn') {
      liveVoice.strike(event.note, event.velocity)
      // Learn the keyboard's range from what is actually played, so the samples stay ready.
      setSelection((current) => (
        event.note < current.soloLow || event.note > current.soloHigh
          ? { ...current, soloLow: Math.min(current.soloLow, event.note), soloHigh: Math.max(current.soloHigh, event.note) }
          : current
      ))
    } else {
      liveVoice.release(event.note)
    }
  }, [liveVoice])

  const [midi] = useState(() => createMidiController(setMidiState, applySnapshot, notesThrough))

  const [handoff, setHandoff] = useState<HandoffPlan | null>(null)
  const handoffRef = useRef<HandoffPlan | null>(null)
  const setPendingHandoff = (next: HandoffPlan | null) => {
    handoffRef.current = next
    setHandoff(next)
  }

  const plan = useMemo(() => buildPattern(selection, handoff ?? undefined), [selection, handoff])
  /** The phrase on its way in, for the readout. Null when nothing is pending. */
  const pendingSequence = handoff && handoff.to !== selection.sequence ? handoff.to : null

  const appliedCode = useRef<string | null>(null)
  const pending = useRef(false)
  const pinnedRef = useRef(pinned)
  /**
   * Forms played since the current one started leading. This is the schedule, so it has to advance
   * on every wrap rather than on every moved form: a form that is not yet due commits no handoff,
   * so counting handoffs would mean it never came due and the music would never move at all.
   */
  const passes = useRef(0)
  /** The same number as state, because the stage has to be able to say how long it has held. */
  const [heldCount, setHeldCount] = useState(0)
  /** Cycle number we already asked about, so each sequence is asked about once. */
  const askedCycle = useRef<number | null>(null)
  /** The cycle whose wrap has already been handled, so a wrap fires once and not per tick. */
  const wrappedCycle = useRef<number | null>(null)
  /** Read at request time, because the answer is built from whatever phrase is playing then. */
  const selectionRef = useRef(selection)
  /** Read from the analysis loop, which must not be re-created when the switch moves. */
  const asking = useRef(true)

  // Only the parts that follow the UI. The current sequence and the candidate set are
  // built at request time, because both move without causing a re-render.
  const context = useRef<Omit<DecisionRequest, 'currentSequence' | 'recentChords' | 'repeatCount' | 'candidates'>>({
    style: findStyle(defaultSelection.style).label,
    vibe: findStyle(defaultSelection.style).description,
    key: defaultSelection.key,
    tempo: defaultSelection.tempo,
    midi: createMidiSnapshot(),
  })

  useEffect(() => {
    selectionRef.current = selection
    context.current = {
      style: findStyle(selection.style).label,
      vibe: findStyle(selection.style).description,
      key: selection.key,
      tempo: selection.tempo,
      midi: snapshot,
    }
  }, [selection, snapshot])

  useEffect(() => () => midi.disconnect(), [midi])
  useEffect(() => () => liveVoice.allNotesOff(), [liveVoice])

  // Keep the solo voice and the key-monitoring switch in sync with the UI.
  useEffect(() => {
    liveVoice.setSolo(selection.solo)
  }, [liveVoice, selection.solo])

  useEffect(() => {
    liveVoice.setEnabled(keysThrough && mixer.audible('solo'))
  }, [liveVoice, keysThrough, mixer])

  // Muting is a gain change on the layer's own orbit, so it lands on the notes that are
  // already ringing and never re-evaluates the pattern. That is also why it can be applied
  // while the jam is stopped and still be in force when it starts - `audioReady` and
  // `isPlaying` are dependencies so the levels are re-applied once there is a graph to set
  // them on, and again after a stop and restart, because Strudel rebuilds its orbits on reset.
  useEffect(() => {
    player.setLayerGains(mixer.layerGains)
  }, [player, mixer.layerGains, audioReady, isPlaying])

  // The keys are the one voice that is not a Strudel pattern, so they cannot be tapped with
  // `.analyze` like the pad. Their output stage is handed to an analyser instead.
  useEffect(() => {
    if (!audioReady) return
    const source = liveVoice.monitor()
    if (source) player.analyser(KEY_ANALYSER, source)
  }, [audioReady, liveVoice, player])

  // Kept out of `selection` deliberately: the level is a mix control, not part of the
  // arrangement, so changing it must not re-evaluate the Strudel pattern.
  useEffect(() => {
    liveVoice.setLevel(leadLevel)
    storeLeadLevel(leadLevel)
  }, [liveVoice, leadLevel])

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
      const asked = selectionRef.current
      const askedStyle = findStyle(asked.style)
      // The chords leading into the decision are the end of the form, not the end of a section:
      // whatever the next form opens on has to answer where this one finished, and a section
      // ending on the tonic is only informative once the whole chart has been accounted for.
      const recent = sequenceChords(chartSections(askedStyle, asked.sequence).flatMap((section) => section.bars)).slice(-3)
      // Staying is deliberately not on the menu. This call only happens because the form is due to
      // move, and a model asked whether to move answers no - asked with staying offered, Jev
      // returned 1.00 for it every time. The question is where the next form is led from.
      const candidates = nextChordCandidates(asked.style, asked.sequence, recent, asked.key)
        .filter((candidate) => !candidate.repeat)
      const response = await requestDecision({
        ...context.current,
        currentSequence: asked.sequence,
        recentChords: recent,
        repeatCount: passes.current,
        candidates,
      })
      setLastDecision(response)
      setNotice(null)
      // The style may have moved on while this was in flight, and then the answer is about a
      // phrase that no longer exists. Nothing is applied from it.
      if (selectionRef.current.style !== asked.style || !asking.current) return
      // No gate on the answer. The schedule has already decided the form moves, so picking where
      // it moves from is exactly the taste question Jev is good at - and every option is a real
      // form, so the answer cannot be wrong, only a different choice.
      const chosen = response.sequence
      // Waiting for the bar line to hand the program over is what made a change arrive late,
      // so it is handed over now. The program keeps the phrase playing and places the new one
      // after it, so the change still lands on the bar line - it just no longer depends on
      // when this code runs.
      if (!pinnedRef.current.sequence) {
        setDirectionSource('jev')
        setPendingHandoff({
          from: asked.sequence,
          to: chosen,
          cycle: player.cycleNow(),
          source: 'jev',
          rhythm: pinnedRef.current.rhythm ? undefined : response.rhythm,
        })
      }
    } catch {
      setNotice('Jev is unreachable - repeating the current phrase')
    } finally {
      pending.current = false
    }
  }, [player])

  // The change the program has been carrying takes effect here, on the bar line: the phrase
  // it names becomes the selection, and the program is rebuilt without a handoff. That
  // rebuild is inaudible because the handoff already places that phrase at this cycle.
  const commitHandoff = useCallback(() => {
    const next = handoffRef.current
    setPendingHandoff(null)
    // One more form played. A form that moved starts counting again from zero.
    passes.current = next && next.to !== selectionRef.current.sequence ? 0 : passes.current + 1
    setHeldCount(passes.current)
    if (!next) return
    setDirectionSource(next.source)
    setSelection((current) => ({
      ...current,
      sequence: next.to,
      ...(next.rhythm ? { rhythm: next.rhythm } : {}),
    }))
  }, [])

  // How much notice the player gets before the form moves: one section of the one playing, and a
  // section is as long as its own music - eight bars or twelve - so it is read off the plan rather
  // than shared as a number.
  const noticeBars = plan.sectionBars[plan.sectionBars.length - 1] ?? plan.bars.length

  // Strudel's own scheduler position drives the bar counter, so the decision lands
  // on the bar line instead of on a wall-clock guess.
  useEffect(() => {
    if (!isPlaying) return
    // The bar playback started on is not a completed form, so the first wrap is the one after it.
    wrappedCycle.current = player.cycleNow()
    const id = window.setInterval(() => {
      const bars = plan.bars.length
      const cycle = player.cycleNow()
      const index = ((cycle % bars) + bars) % bars
      setBarIndex(index)
      // Ask once per form, one section before the end, and only when the form is due to move.
      // A whole section of notice is the point: the form is what the player is committing to, so
      // they should know which one comes next while there is still a section of this one to play.
      // The answer is handed over as soon as it arrives and still lands on the bar line.
      const due = passes.current >= HOLD_FORMS - 1
      if (due && index === Math.max(0, bars - noticeBars) && asking.current && askedCycle.current !== cycle) {
        askedCycle.current = cycle
        void askJev()
      }
      if (index === 0 && wrappedCycle.current !== cycle) {
        wrappedCycle.current = cycle
        commitHandoff()
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [isPlaying, plan.bars.length, noticeBars, player, askJev, commitHandoff])

  // Fetch the arrangement's samples up front so nothing waits on the network.
  useEffect(() => {
    if (!audioReady) return
    void player.warm(plan.warm).then((count) => setBacking((current) => current + count))
  }, [audioReady, plan, player])

  // Keep the solo instrument's samples decoded across the configured key range.
  useEffect(() => {
    if (!audioReady) return
    let cancelled = false
    void liveVoice.preload(selection.soloLow, selection.soloHigh).then((count) => {
      if (!cancelled) setPreloaded(count)
    })
    return () => {
      cancelled = true
    }
  }, [audioReady, liveVoice, selection.solo, selection.soloLow, selection.soloHigh])

  const update = (patch: Partial<Selection>) => setSelection((current) => ({ ...current, ...patch }))

  /** A pin is a dimension the player has taken over, so Jev stops touching it. */
  const setPin = (dimension: 'sequence' | 'rhythm', value: boolean) => {
    pinnedRef.current = { ...pinnedRef.current, [dimension]: value }
    setPinned(pinnedRef.current)
  }

  const toggleSession = async () => {
    setNotice(null)
    if (isPlaying) {
      player.stop()
      appliedCode.current = null
      setIsPlaying(false)
      // Nothing is half-applied into a session that is no longer running.
      setPendingHandoff(null)
      return
    }

    try {
      // Runs inside the click handler so the AudioContext is allowed to resume. Strudel is
      // initialised and every sound is prepared *before* playback starts, so the first bars
      // are not competing with a download.
      await player.prepare()
      const [backingCount, soloCount] = await Promise.all([
        player.warm(plan.warm),
        liveVoice.preload(selection.soloLow, selection.soloHigh),
      ])
      setBacking((current) => current + backingCount)
      setPreloaded(soloCount)
      await player.start(plan)
      appliedCode.current = plan.code
      setIsPlaying(true)
      setAudioReady(true)
    } catch (error) {
      setNotice(describe(error, 'Audio could not start'))
      return
    }

    if (midiState.status === 'idle') void midi.connect()
    // No ask here: the form is not due to move until it has played, and asking now would only
    // produce an answer about a form that has not been heard yet.
  }

  // A style is self-contained, so picking one also switches to its own first phrase and
  // its own lead: neither exists in the style being left.
  const chooseStyle = (id: Selection['style']) => {
    const next = findStyle(id)
    passes.current = 0
    setHeldCount(0)
    // Any change on its way in names a phrase from the style being left, so it cannot survive.
    setPendingHandoff(null)
    setDirectionSource('local')
    setLastDecision(null)
    update({ style: id, sequence: homeSequence(next).id, solo: next.solo })
  }

  // Asking for a phrase does not cut the one playing short. The program is rebuilt straight
  // away with the new phrase placed after the rest of the current one, so the change lands on
  // the bar line without depending on when this runs.
  const chooseSequence = (id: Selection['sequence']) => {
    const isCurrent = id === selection.sequence
    setPin('sequence', isCurrent ? !pinned.sequence : true)
    setDirectionSource('local')
    setLastDecision(null)
    if (isCurrent) {
      // Asking for the phrase already playing cancels a change on its way in, and hands
      // control back to Jev.
      setPendingHandoff(null)
      return
    }
    setPendingHandoff({ from: selection.sequence, to: id, cycle: player.cycleNow(), source: 'local' })
  }

  const chooseRhythm = (nextRhythm: Selection['rhythm']) => {
    setPin('rhythm', nextRhythm === selection.rhythm ? !pinned.rhythm : true)
    setDirectionSource('local')
    update({ rhythm: nextRhythm })
  }

  // Turning Jev off stops the asks. A change Jev asked for is dropped; one the player asked
  // for is left alone, because that was not Jev's to cancel.
  const toggleJev = (next: boolean) => {
    asking.current = next
    setJevEnabled(next)
    if (!next) {
      if (handoffRef.current?.source === 'jev') setPendingHandoff(null)
      setLastDecision(null)
      setDirectionSource('local')
    }
  }

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

  const heard = snapshot.activeNotes.map(noteName)

  // Everything below is scoped to the chosen style: its phrases, its leads, its chords.
  const style = findStyle(selection.style)
  const styleSolos = style.solos.map((id) => findInstrument(id))

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="wordmark"><span className="signal-dot" />JEV / STRUDEL</div>
        <div className="session-state"><span className={isPlaying ? 'live-dot' : 'idle-dot'} />{isPlaying ? 'JAM IN PROGRESS' : 'READY TO LISTEN'}</div>
      </header>

      <section className="intro">
        <p className="eyebrow">A responsive musical second mind</p>
        <h1>Make a little<br /><em>room for surprise.</em></h1>
        <p className="lede">Set the atmosphere, settle into a form, and let Jev decide when it is worth moving on.</p>
      </section>

      <section className="workspace" aria-label="Jam controls">
        <ControlRail
          state={{
            selection,
            isPlaying,
            notice,
            midi: midiState,
            snapshot,
            preloaded,
            backing,
            leadLevel,
            keysThrough,
            audioReady,
            jevEnabled,
          }}
          actions={{
            chooseStyle,
            update,
            toggleSession: () => void toggleSession(),
            setLeadLevel,
            setKeysThrough,
            toggleJev,
            connectMidi: () => void midi.connect(),
            audition,
          }}
        />

        <DecisionStage
          state={{
            plan,
            barIndex,
            pendingSequence,
            directionSource,
            jevEnabled,
            pinned,
            lastDecision,
            heldCount,
            selection,
            style,
            heard,
            isPlaying,
            player,
            mixer,
          }}
          actions={{ chooseSequence }}
        />
      </section>

      <Shaping
        selection={selection}
        styleLabel={style.label}
        solos={styleSolos}
        rhythmPinned={pinned.rhythm}
        update={update}
        chooseRhythm={chooseRhythm}
      />

      <details className="source">
        <summary>What is playing right now</summary>
        <pre>{plan.code}</pre>
      </details>

      <footer><span>SNAPSHOT <strong>{selection.key}</strong> · {selection.tempo} BPM</span><span>{isPlaying ? 'STRUDEL RUNNING' : 'AUDIO ENGINE IDLE'}</span><span>SESSION 0001</span></footer>
    </main>
  )
}

export default App
