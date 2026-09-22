/**
 * The mixer: which parts are silenced, which are heard alone, how loud each one is, and the gains
 * that follow.
 *
 * Mute wins over solo, so a part that is both stays silent - what every mixer does, and it
 * keeps the two switches independent.
 *
 * The gains are levels for each layer's own Strudel orbit rather than decisions about the
 * pattern, so applying them never re-evaluates the program.
 *
 * A level is a trim on top of the balance the style itself was written with, not a second opinion
 * on it: the style's own gains are the arrangement's design, and these start at unity for that
 * reason. That is also why the levels are not persisted - they belong to the session, like the
 * mute and solo switches they sit next to.
 */
import { useCallback, useMemo, useState } from 'react'
import type { LayerId } from '../domain/vocabulary'

/** The parts the mixer can reach. The keys are not a pattern layer, so they are excluded. */
export type MixableLayer = Exclude<LayerId, 'solo'>

/** Where a level starts: the style's own balance, untouched. */
const UNITY = 1

const MIXABLE: MixableLayer[] = ['drums', 'perc', 'bass', 'pad', 'chords']

export type Mixer = {
  muted: LayerId[]
  soloed: LayerId[]
  /** Each pattern layer's trim, as a fraction of the style's own level. */
  levels: Record<MixableLayer, number>
  /** Has anything been trimmed away from the style's own balance? */
  trimmed: boolean
  /** Does this part sound, given the mute and solo switches? */
  audible: (id: LayerId) => boolean
  /** Orbit levels for the pattern layers, for `player.setLayerGains`. */
  layerGains: Record<MixableLayer, number>
  toggleMute: (id: LayerId) => void
  toggleSolo: (id: LayerId) => void
  setLevel: (id: MixableLayer, level: number) => void
  resetLevels: () => void
}

const toggleIn = (list: LayerId[], id: LayerId) => (
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]
)

const unityLevels = (): Record<MixableLayer, number> => (
  Object.fromEntries(MIXABLE.map((id) => [id, UNITY])) as Record<MixableLayer, number>
)

export function useMixer(): Mixer {
  const [muted, setMuted] = useState<LayerId[]>([])
  const [soloed, setSoloed] = useState<LayerId[]>([])
  const [levels, setLevels] = useState<Record<MixableLayer, number>>(unityLevels)

  /** A part sounds when nothing is soloed and it is not muted, or when it is soloed. */
  const audible = useCallback(
    (id: LayerId) => !muted.includes(id) && (soloed.length === 0 || soloed.includes(id)),
    [muted, soloed],
  )

  const layerGains = useMemo(() => (
    Object.fromEntries(MIXABLE.map((id) => [id, audible(id) ? levels[id] : 0])) as Record<MixableLayer, number>
  ), [audible, levels])

  return {
    muted,
    soloed,
    levels,
    trimmed: MIXABLE.some((id) => levels[id] !== UNITY),
    audible,
    layerGains,
    toggleMute: useCallback((id: LayerId) => setMuted((current) => toggleIn(current, id)), []),
    toggleSolo: useCallback((id: LayerId) => setSoloed((current) => toggleIn(current, id)), []),
    setLevel: useCallback(
      (id: MixableLayer, level: number) => setLevels((current) => ({ ...current, [id]: level })),
      [],
    ),
    resetLevels: useCallback(() => setLevels(unityLevels()), []),
  }
}
