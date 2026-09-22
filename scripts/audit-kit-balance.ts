/**
 * Which voice dominates each kit?
 *
 * A mix can be wrong *inside* one layer, and then no level on that layer is right: turning the layer
 * down turns the loud voice down and the quiet ones with it. This is the check for that, and it is
 * what caught the blues' hi-hat at 83% of its own drum bus, after-hours' ride at 97% and
 * broken-beat's snare at 79%.
 *
 * A voice's contribution is its sample level x its onsets per bar / 4 x the layer gain it plays at.
 * The sample levels are measured from the running app rather than assumed, by playing each voice
 * alone at gain 1 with four onsets to the bar and reading the master tap; peaks are useless for this
 * because nearly every drum sample peaks near full scale, so only rms discriminates. Re-measure them
 * if a bank's version changes, and treat the numbers below as belonging to the pinned banks.
 *
 * The threshold is a warning and not a failure, deliberately. What counts as too far above its own
 * kick depends on the style: night-drive's kick is at 99% and that is what house is, while the same
 * number for a hi-hat is a headache. The judgement is the point; the arithmetic is just what makes
 * the judgement possible. So what is flagged is a kit whose loudest voice is more than twice its
 * next loudest, which is the one shape that is wrong for every style - a sound with decoration
 * rather than a kit.
 *
 * Read the numbers as evidence and not as the answer, because rms over a bar favours long low sounds:
 * a ring-out kick carries far more energy than a 200ms clap of the same apparent loudness, and an
 * equal-loudness curve would not call night-drive's kick nine times its clap. The measure is at its
 * most reliable exactly where the complaints were - a voice with many onsets (eight hats, five ride
 * hits) is sustained energy over time, which is what rms describes and what makes a sound tiring.
 */
import { styles } from '../src/domain/styles'

type Levels = Record<string, number>

const SAMPLE: Record<string, Levels> = {
  RolandTR909: { bd: 0.2319, cp: 0.0517, oh: 0.1033, hh: 0.0463, sd: 0.1419 },
  AkaiMPC60: { bd: 0.1166, sd: 0.3132, 'hh:2': 0.0472, rim: 0.0626 },
  RolandR8: { bd: 0.1254, rd: 0.1129, rim: 0.0315, sd: 0.0930, hh: 0.0539 },
  RolandTR808: { bd: 0.0555, rim: 0.0321, sh: 0.0257 },
  LinnDrum: { bd: 0.1399, sd: 0.1512, hh: 0.0845, cb: 0.1448, sh: 0.0797 },
}

/** Split on commas that are not inside brackets or parens - `bd(1,4), rd(5,8)` is two voices. */
function voices(pattern: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const char of pattern) {
    if (char === '[' || char === '(') depth += 1
    if (char === ']' || char === ')') depth -= 1
    if (char === ',' && depth === 0) { out.push(current.trim()); current = '' } else current += char
  }
  if (current.trim()) out.push(current.trim())
  return out
}

/** Onsets per bar, counted per sound name: `x*n` is n, `x(k,n)` is k, a bare token is 1, `~` none. */
function onsets(voice: string): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (sound: string, by: number) => counts.set(sound, (counts.get(sound) ?? 0) + by)
  for (const token of voice.match(/\[[^\]]*\](?:\*\d+)?|[^\s]+/g) ?? []) {
    if (token === '~') continue
    const sounds = (token.match(/[a-z]+(?::\d+)?/g) ?? []).filter((s) => s !== 'n')
    if (!sounds.length) continue
    const repeat = token.match(/\*(\d+)$/)
    const euclid = token.match(/\((\d+),/)
    const times = repeat ? Number(repeat[1]) : euclid ? Number(euclid[1]) : 1
    sounds.forEach((sound) => add(sound, times))
  }
  return counts
}

const label = (sound: string) => sound

for (const style of styles) {
  const layers: [string, number][] = [
    ...style.drums.voices.flatMap((voice): [string, number][] =>
      voices(voice.pattern).map((pattern): [string, number] => [pattern, style.drums.gain * (voice.gain ?? 1)]),
    ),
    ...voices(style.perc.pattern).map((v): [string, number] => [v, style.perc.gain]),
  ]
  const rows: { voice: string; onsets: number; share: number }[] = []
  layers.forEach(([voice, gain]) => {
    onsets(voice).forEach((count, sound) => {
      const base = sound.replace(/:\d+$/, '')
      const per = SAMPLE[style.drums.bank ?? '']?.[sound] ?? SAMPLE[style.drums.bank ?? '']?.[base] ?? 0
      rows.push({ voice: sound, onsets: count, share: per * (count / 4) * gain })
    })
  })
  const bus = Math.sqrt(rows.reduce((sum, row) => sum + row.share ** 2, 0))
  const loudest = Math.max(...rows.map((row) => row.share))
  const next = Math.max(...rows.filter((row) => row.share < loudest).map((row) => row.share), 0)
  const alone = loudest > next * 2
  const parts = rows
    .map((row) => {
      const share = (100 * row.share) / bus
      const mark = alone && row.share === loudest ? '!' : ' '
      return `${label(row.voice)}${' '.repeat(Math.max(1, 6 - row.voice.length))}${row.onsets}/bar ${String(Math.round(share)).padStart(3)}%${mark}`
    })
    .join('   ')
  console.log(`${style.id.padEnd(12)} bus ${bus.toFixed(4)}   ${parts}`)
}
