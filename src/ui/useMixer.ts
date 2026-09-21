/**
 * The mixer: which parts are silenced, which are heard alone, and the gains that follow.
 *
 * Mute wins over solo, so a part that is both stays silent - what every mixer does, and it
 * keeps the two switches independent.
 *
 * The gains are levels for each layer's own Strudel orbit rather than decisions about the
 * pattern, so applying them never re-evaluates the program.
 */
import { useCallback, useMemo, useState } from 'react'
import type { LayerId } from '../domain/vocabulary'

/** The parts the mixer can reach. The keys are not a pattern layer, so they are excluded. */
export type MixableLayer = Exclude<LayerId, 'solo'>

export type Mixer = {
  muted: LayerId[]
  soloed: LayerId[]
  /** Does this part sound, given the mute and solo switches? */
  audible: (id: LayerId) => boolean
  /** Orbit levels for the pattern layers, for `player.setLayerGains`. */
  layerGains: Record<MixableLayer, number>
  toggleMute: (id: LayerId) => void
  toggleSolo: (id: LayerId) => void
}

const toggleIn = (list: LayerId[], id: LayerId) => (
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]
)

export function useMixer(): Mixer {
  const [muted, setMuted] = useState<LayerId[]>([])
  const [soloed, setSoloed] = useState<LayerId[]>([])

  /** A part sounds when nothing is soloed and it is not muted, or when it is soloed. */
  const audible = useCallback(
    (id: LayerId) => !muted.includes(id) && (soloed.length === 0 || soloed.includes(id)),
    [muted, soloed],
  )

  const layerGains = useMemo(() => ({
    drums: audible('drums') ? 1 : 0,
    bass: audible('bass') ? 1 : 0,
    pad: audible('pad') ? 1 : 0,
    chords: audible('chords') ? 1 : 0,
  }), [audible])

  return {
    muted,
    soloed,
    audible,
    layerGains,
    toggleMute: useCallback((id: LayerId) => setMuted((current) => toggleIn(current, id)), []),
    toggleSolo: useCallback((id: LayerId) => setSoloed((current) => toggleIn(current, id)), []),
  }
}
