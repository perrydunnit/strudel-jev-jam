/**
 * Checks the handoff composition without a browser.
 *
 * A phrase change is handed to the program early, so the program has to carry both phrases:
 * the rest of the one playing, then the incoming one. This checks that composition for every
 * phase of a phrase, and that the phrase in progress is never touched. Nothing here is tied
 * to a four-bar or eight-bar phrase: the length comes from the built program.
 *
 * Run with: npx tsx scripts/verify-handoff.ts
 */
import { buildPattern } from '../src/domain/pattern'
import { defaultSelection } from '../src/domain/styles'
import type { Handoff, Selection } from '../src/domain/vocabulary'

/** The groups of the first slowcat in a part, one group per bar. */
function slowcatGroups(part: string): string[] {
  const body = part.slice(1, part.indexOf('>'))
  const groups: string[] = []
  let depth = 0
  let current = ''
  for (const character of body) {
    if (character === '[' || character === '<') depth += 1
    if (character === ']' || character === '>') depth -= 1
    if (character === ' ' && depth === 0) {
      groups.push(current)
      current = ''
      continue
    }
    current += character
  }
  groups.push(current)
  return groups
}

/** The pad's slowcat, which is one chord group per bar. */
function padBars(code: string): string[] {
  const pad = code.split('note("').find((part) => part.includes('clip(1)'))
  if (!pad) throw new Error('no pad part in the program')
  return slowcatGroups(pad)
}

const style = 'night-drive'
const base: Selection = { ...defaultSelection, style, sequence: `${style}/open` }
const incoming: Selection = { ...base, sequence: `${style}/cadence` }

const playing = padBars(buildPattern(base).code)
const next = padBars(buildPattern(incoming).code)
const phrase = playing.length
const handoffProgram = padBars(buildPattern(base, { from: base.sequence, to: incoming.sequence, cycle: 0 }).code)

console.log(`phrase length: ${phrase} bars; handoff program: ${handoffProgram.length} bars`)
console.log(`playing  (${base.sequence}):`, playing.join(' | '))
console.log(`incoming (${incoming.sequence}):`, next.join(' | '))

let failures = 0
const fail = (message: string) => {
  failures += 1
  console.log(`  ${message}`)
}

// The incoming phrase has to begin on a bar line and still have all of itself in front of it,
// which needs a whole number of phrases, and more than one of them.
if (handoffProgram.length % phrase !== 0 || handoffProgram.length <= phrase) {
  fail(`the handoff program is ${handoffProgram.length} bars: not a whole number of phrases, and longer than one`)
}

const cycles = [...Array.from({ length: handoffProgram.length }, (_, index) => index), 23, 24, 25, 40, 41]
for (const cycle of cycles) {
  const handoff: Handoff = { from: base.sequence, to: incoming.sequence, cycle }
  const bars = padBars(buildPattern(base, handoff).code)
  const size = bars.length
  const at = cycle % size
  // Bars of the phrase playing now that are still to come, the one in progress included.
  const remaining = phrase - (cycle % phrase)
  const problems: string[] = []

  if (bars.length !== handoffProgram.length) problems.push(`${bars.length} bars, expected ${handoffProgram.length}`)
  for (let ahead = 0; ahead < size; ahead += 1) {
    const slot = (at + ahead) % size
    const expected = ahead < remaining
      ? playing[(cycle + ahead) % phrase]
      : next[(ahead - remaining) % phrase]
    if (bars[slot] !== expected) {
      problems.push(`slot ${slot} (+${ahead} cycles) = ${bars[slot]}, expected ${expected}`)
    }
  }
  // The phrase playing now must be untouched, and the switch must land on the incoming bar 1.
  if (bars[at] !== playing[cycle % phrase]) problems.push('the bar in progress changed')
  if (bars[(at + remaining) % size] !== next[0]) problems.push('the switch is not on the incoming bar 1')

  failures += problems.length
  console.log(
    `cycle ${String(cycle).padStart(2)} (bar ${(cycle % phrase) + 1} of ${phrase}, slot ${at}, ${remaining} left): `
    + (problems.length ? `FAIL - ${problems.join('; ')}` : 'ok'),
  )
}

// After the change has landed the app rebuilds without a handoff, which must be exactly the
// incoming phrase: that rebuild is what stops the old bars ever coming back around.
if (padBars(buildPattern(incoming).code).join('|') !== next.join('|')) fail('the settled program is not the incoming phrase')

console.log(failures === 0 ? '\nhandoff: all checks passed' : `\nhandoff: ${failures} failure(s)`)
process.exitCode = failures === 0 ? 0 : 1
