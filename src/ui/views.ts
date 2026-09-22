/**
 * Which Strudel renderer each voice gets.
 *
 * A decision about what a voice *is*: the drums and the percussion get the event grid, the bass a roll of pitch
 * over time, the chords the circular pitch view, the pad a spectrum because a held chord has
 * no events to plot, and the live keys an oscilloscope because they are not a pattern at all
 * and have no haps for the hap-based views to read.
 *
 * It is a value rather than a type, so it cannot live beside the component that draws it -
 * a module that exports both would break Fast Refresh.
 */
import type { VoiceView } from '../audio/voiceViews'
import type { LayerId } from '../domain/vocabulary'

export const VOICE_VIEWS: Record<LayerId, VoiceView> = {
  drums: 'punchcard',
  // The percussion is an event grid like the drums: hits with no pitch to plot, and sparse enough
  // that where it is silent is as much of the picture as where it sounds.
  perc: 'punchcard',
  bass: 'pianoroll',
  pad: 'spectrum',
  chords: 'pitchwheel',
  solo: 'scope',
}
