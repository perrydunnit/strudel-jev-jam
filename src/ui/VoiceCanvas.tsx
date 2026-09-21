/**
 * One voice, drawn with Strudel's own renderers on its own animation frame.
 *
 * Drawing is paused while the transport is stopped. The views then hold their last frame
 * instead of repainting a playhead that is not moving.
 *
 * Which renderer each voice gets is in `views.ts`, because a module that exports both a value
 * and a component breaks Fast Refresh.
 */
import { useEffect, useRef } from 'react'
import { createVoiceView, type VoiceView } from '../audio/voiceViews'
import type { StrudelPlayer } from '../audio/strudelPlayer'

type Props = {
  view: VoiceView
  /** The layer's orbit. Absent for the live keys, which are not a pattern layer. */
  orbit?: number
  player: StrudelPlayer
  playing: boolean
}

export function VoiceCanvas({ view, orbit, player, playing }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const draw = createVoiceView({ view, canvas: element, orbit, player })
    draw()
    if (!playing) return
    let frame = window.requestAnimationFrame(function step() {
      draw()
      frame = window.requestAnimationFrame(step)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [view, orbit, player, playing])

  return <canvas className="voice-view" ref={canvas} aria-hidden="true" />
}
