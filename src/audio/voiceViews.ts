// The package's main entry is a bundle that inlines its own copy of @strudel/core, and two
// copies of core break Strudel's module-level state. The unbundled modules import the shared
// one instead - the same reason `@strudel/web` is aliased to its unbundled entry in vite.
import { __pianoroll } from '@strudel/draw/pianoroll.mjs'
import { pitchwheel } from '@strudel/draw/pitchwheel.mjs'
import { analysers, drawFrequencyScope, drawTimeScope } from '@strudel/web'
import type { StrudelPlayer } from './strudelPlayer'

/**
 * The five viewing mechanisms, one per voice.
 *
 * Four of them are Strudel's own renderers, fed the haps of that one layer: a pianoroll
 * for pitch over time, a punchcard for events, a pitchwheel for the chord figure's
 * harmonic shape. The two live ones are the analyser views Strudel draws for its own
 * scopes - the pad's spectrum, since a held chord has no events to plot, and the keys'
 * oscilloscope, since the live voice is not a Strudel pattern and has no haps at all.
 */
export type VoiceView = 'pianoroll' | 'punchcard' | 'pitchwheel' | 'spectrum' | 'scope'

const INK = '#eee7db'
const ACID = '#c8d86c'
const CORAL = '#ef795f'
/** Drawn for everything that is not the note in question: other notes, the playhead, the grid. */
const KIND = 'rgba(238, 231, 219, 0.22)'
const DIM = 'rgba(238, 231, 219, 0.4)'

/** The analyser id the live keys are tapped on. Orbits use their own number as the id. */
export const KEY_ANALYSER = 5

/** How much of the phrase a note view has on screen, and where the playhead sits in it. */
const WINDOW = 4
const PLAYHEAD = 0.5

export type VoiceViewOptions = {
  view: VoiceView
  canvas: HTMLCanvasElement
  /** The orbit this layer plays in, for every view except the live keys. */
  orbit?: number
  player: StrudelPlayer
}

/**
 * Builds the frame-by-frame drawing for one voice. The returned function is called on every
 * animation frame; it is a no-op until Strudel has something to draw, so the views are safe
 * to mount before the first note.
 */
export function createVoiceView({ view, canvas, orbit, player }: VoiceViewOptions): () => void {
  /**
   * Strudel's renderers read `ctx.canvas.width`, so the backing store is sized in device
   * pixels and no transform is applied: the drawing then lands sharp without the renderer
   * scaling it twice.
   */
  const fit = () => {
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round((canvas.clientWidth || 120) * ratio))
    const height = Math.max(1, Math.round((canvas.clientHeight || 40) * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  /** Set once a frame throws: a view that cannot draw should stop trying, not spam. */
  let broken = false

  return () => {
    if (broken) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // A visualiser must never be able to stop the music, so a bad frame is swallowed and
    // the view retires itself rather than throwing into the render loop.
    try {
      draw(ctx)
    } catch (error) {
      broken = true
      console.warn(`[view] ${view} could not draw`, error)
    }
  }

  function draw(ctx: CanvasRenderingContext2D) {
    fit()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (view === 'spectrum') {
      // A held chord has no events to plot, so this is the analyser Strudel keeps for the
      // layer's orbit. It exists once the layer has sounded and been routed through
      // `.analyze`, and until then the frame is skipped: Strudel's frequency renderer reads
      // a `canvas` binding it declares further down its body when the analyser is missing,
      // so it throws instead of drawing the idle line the time-domain renderer draws.
      const id = orbit ?? 0
      const analyser = analysers[id]
      if (!analyser) return
      drawFrequencyScope(analyser, { ctx, id, color: ACID, scale: 0.85, pos: 0.98, min: -110, max: -12 })
      return
    }

    if (view === 'scope') {
      const analyser = analysers[KEY_ANALYSER]
      drawTimeScope(analyser, { ctx, id: KEY_ANALYSER, color: CORAL, thickness: 2, scale: 0.42, pos: 0.5 })
      return
    }

    const time = player.timeNow()
    const haps = player.voiceHaps(orbit ?? 0, WINDOW)
    if (view === 'punchcard') {
      // The drum layer has no pitch to plot, so the useful axis is time and the useful label
      // is the sample name: a horizontal roll of the bar's events, every hit in the bar
      // drawn, not only the one sounding. This is Strudel's punchcard without the value
      // axis, in the shape the panel has room for.
      __pianoroll({
        ctx, time, haps,
        cycles: WINDOW, playhead: PLAYHEAD, labels: 1,
        stroke: 0, fill: 1, fillActive: 1,
        active: ACID, inactive: KIND, playheadColor: DIM, fontFamily: 'monospace',
      })
      return
    }
    if (view === 'pitchwheel') {
      pitchwheel({ ctx, haps, id: undefined, thickness: 2, hapRadius: 3, margin: 4 })
      return
    }
    __pianoroll({
      ctx, time, haps,
      cycles: WINDOW, playhead: PLAYHEAD,
      active: INK, inactive: KIND, playheadColor: DIM,
      minMidi: 26, maxMidi: 62, stroke: 1, fill: 1,
    })
  }
}
