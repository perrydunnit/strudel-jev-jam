/**
 * The lead level, remembered across reloads.
 *
 * Deliberately not part of `Selection`. The level is a mix control rather than part of the
 * arrangement, so moving it must not rebuild the Strudel pattern - and `buildPattern` is
 * memoised on the selection, so putting it there would re-evaluate the program on every
 * drag of the slider.
 */
import { DEFAULT_LEAD_LEVEL, LEAD_LEVEL_RANGE } from '../audio/liveVoice'

const STORAGE_KEY = 'jev.leadLevel'

export function storedLeadLevel(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const value = raw === null ? Number.NaN : Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_LEAD_LEVEL
  return Math.min(LEAD_LEVEL_RANGE.max, Math.max(LEAD_LEVEL_RANGE.min, value))
}

export function storeLeadLevel(level: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(level))
}
