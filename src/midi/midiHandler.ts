export type MidiDevice = { id: string; name: string }

export type MidiSnapshot = {
  /** Notes that should still be sounding, including pedal-held notes. */
  activeNotes: number[]
  heldNotes: number[]
  sustainedNotes: number[]
  recentNotes: number[]
  averageVelocity: number
  sustain: boolean
  lastControl: { controller: number; value: number } | null
  lastEventAt: number | null
}

export type MidiStatus = 'idle' | 'connecting' | 'ready' | 'unsupported' | 'denied' | 'error'

export type MidiState = { status: MidiStatus; devices: MidiDevice[]; message: string }

export type MidiNoteEvent = { kind: 'noteOn' | 'noteOff'; note: number; velocity: number }

export type MidiController = {
  state: () => MidiState
  snapshot: () => MidiSnapshot
  connect: () => Promise<MidiState>
  disconnect: () => void
}

/**
 * Minimal structural types for Web MIDI. Kept local so this module does not
 * depend on lib.dom's MIDI declarations, which vary between TS releases.
 */
type MidiMessageEvent = { data: Uint8Array }
type MidiInputPort = { id: string; name?: string | null; onmidimessage: ((event: MidiMessageEvent) => void) | null }
type MidiAccess = { inputs: Map<string, MidiInputPort>; onstatechange: ((event: unknown) => void) | null }
type RequestMidiAccess = (options?: { sysex?: boolean }) => Promise<MidiAccess>

const MAX_RECENT_NOTES = 16
const SUSTAIN_CONTROLLER = 64
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function noteName(note: number): string {
  return `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`
}

function sortedUnique(notes: number[]): number[] {
  return [...new Set(notes)].sort((a, b) => a - b)
}

export function createMidiSnapshot(): MidiSnapshot {
  return {
    activeNotes: [],
    heldNotes: [],
    sustainedNotes: [],
    recentNotes: [],
    averageVelocity: 0,
    sustain: false,
    lastControl: null,
    lastEventAt: null,
  }
}

/** Classifies a channel message as a note event, or `null` when it is not one. */
export function parseNoteEvent(data: Uint8Array): MidiNoteEvent | null {
  if (data.length < 3) return null
  const command = data[0] & 0xf0
  const note = data[1]
  const velocity = data[2]
  if (command === 0x90 && velocity > 0) return { kind: 'noteOn', note, velocity }
  if (command === 0x80 || (command === 0x90 && velocity === 0)) return { kind: 'noteOff', note, velocity: 0 }
  return null
}

/**

/**
 * Normalizes note-on, note-off (including velocity-0 note-off) and sustain pedal
 * messages into a musical snapshot. Non note/pedal messages are ignored.
 */
export function normalizeMidiMessage(data: Uint8Array, current: MidiSnapshot): MidiSnapshot {
  if (data.length < 2) return current

  const command = data[0] & 0xf0
  const now = Date.now()

  if (command === 0xb0 && data.length >= 3) {
    const controller = data[1]
    const value = data[2]
    if (controller !== SUSTAIN_CONTROLLER) {
      return { ...current, lastControl: { controller, value }, lastEventAt: now }
    }
    const sustain = value >= 64
    return {
      ...current,
      sustain,
      sustainedNotes: sustain ? current.sustainedNotes : [],
      activeNotes: sustain ? current.activeNotes : sortedUnique(current.heldNotes),
      lastControl: { controller, value },
      lastEventAt: now,
    }
  }

  const event = parseNoteEvent(data)
  if (!event) return current
  const { note, velocity } = event
  const isNoteOn = event.kind === 'noteOn'

  const held = new Set(current.heldNotes)
  const sustained = new Set(current.sustainedNotes)

  if (isNoteOn) {
    held.add(note)
    sustained.delete(note)
  } else {
    held.delete(note)
    if (current.sustain) sustained.add(note)
    else sustained.delete(note)
  }

  const recentNotes = isNoteOn ? [...current.recentNotes, note].slice(-MAX_RECENT_NOTES) : current.recentNotes
  const played = recentNotes.length
  const averageVelocity = isNoteOn && played > 0
    ? Math.round((current.averageVelocity * (played - 1) + velocity) / played)
    : current.averageVelocity

  return {
    activeNotes: sortedUnique([...held, ...sustained]),
    heldNotes: [...held].sort((a, b) => a - b),
    sustainedNotes: [...sustained].sort((a, b) => a - b),
    recentNotes,
    averageVelocity,
    sustain: current.sustain,
    lastControl: current.lastControl,
    lastEventAt: now,
  }
}

export function createMidiController(
  onState: (state: MidiState) => void,
  onSnapshot?: (snapshot: MidiSnapshot) => void,
  onNote?: (event: MidiNoteEvent) => void,
): MidiController {
  let snapshot = createMidiSnapshot()
  let state: MidiState = { status: 'idle', devices: [], message: 'Not connected yet' }
  let access: MidiAccess | null = null

  const publish = (next: MidiState) => {
    state = next
    onState(next)
  }

  const listen = (current: MidiAccess) => {
    const devices: MidiDevice[] = []
    for (const input of current.inputs.values()) {
      input.onmidimessage = (event) => {
        snapshot = normalizeMidiMessage(event.data, snapshot)
        const noteEvent = parseNoteEvent(event.data)
        if (noteEvent) onNote?.(noteEvent)
        onSnapshot?.(snapshot)
      }
      devices.push({ id: input.id, name: input.name || 'Unnamed MIDI input' })
    }
    // A device unplugged mid-note never sends note-off, so release what it left held.
    if (snapshot.activeNotes.length) {
      for (const note of snapshot.activeNotes) onNote?.({ kind: 'noteOff', note, velocity: 0 })
      snapshot = { ...snapshot, activeNotes: [], heldNotes: [], sustainedNotes: [] }
      onSnapshot?.(snapshot)
    }
    publish({
      status: 'ready',
      devices,
      message: devices.length
        ? `Listening to ${devices.map((device) => device.name).join(', ')}`
        : 'No MIDI inputs found. Connect the keyboard over USB, then rescan.',
    })
  }

  return {
    state: () => state,
    snapshot: () => snapshot,
    connect: async () => {
      const requester = (navigator as Navigator & { requestMIDIAccess?: RequestMidiAccess }).requestMIDIAccess
      if (typeof requester !== 'function') {
        publish({
          status: 'unsupported',
          devices: [],
          message: 'Web MIDI is unavailable here. Use Chrome or Edge over https:// or localhost.',
        })
        return state
      }
      if (!window.isSecureContext) {
        publish({
          status: 'error',
          devices: [],
          message: 'Web MIDI needs a secure context. Serve this page over https:// or http://localhost.',
        })
        return state
      }

      publish({ status: 'connecting', devices: state.devices, message: 'Waiting for MIDI permission…' })
      try {
        const granted = await requester.call(navigator, { sysex: false })
        const current = granted as unknown as MidiAccess
        access = current
        // Hot-plug: rebuild the input list whenever devices come and go.
        current.onstatechange = () => listen(current)
        listen(current)
      } catch (error) {
        const denied = error instanceof DOMException
          && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
        publish({
          status: denied ? 'denied' : 'error',
          devices: [],
          message: denied
            ? 'MIDI access is blocked. Allow MIDI in the site permissions (padlock icon), then rescan.'
            : error instanceof Error ? error.message : 'MIDI connection failed',
        })
      }
      return state
    },
    disconnect: () => {
      if (access) {
        for (const input of access.inputs.values()) input.onmidimessage = null
        access.onstatechange = null
      }
      access = null
      snapshot = createMidiSnapshot()
      publish({ status: 'idle', devices: [], message: 'Disconnected' })
    },
  }
}

