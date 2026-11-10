// Name and place accuracy, measured in the browser (scripts/eval-browser.ts).
//
//   npm run eval:names                         the names dev split: tune against this one
//   npm run eval:names -- --misses             also list every missed and wrong name or place
//   npm run eval:names -- --set generated      another set (see STORED_SETS in name-detections.ts)
//   npm run eval:names -- --set generated --save
//                                              store the set's detections for the published numbers
//
// Each text is checked by the rules and the name model together, as in the
// app. The dev split (and its look-alikes: greetings followed by words that
// are not names) may be used to tune the name rules; every other set is only
// ever reported, never tuned against. The published tables (`npm run eval`)
// are computed from the stored detections.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { detect } from '../core/detect/index.ts'
import { combined } from '../core/detect/merge.ts'
import type { Detection } from '../core/detect/types.ts'
import type { PiiType } from '../core/pii-types.ts'
import { NAME_MODEL } from '../deploy/model.ts'
import { detectNamesInBrowser } from './eval-browser.ts'
import { evaluate, itemsOf, nameTables, positionTable, toMarkdown, type Mistake } from './eval.ts'
import { readStoredDetections, STORED_SETS, storedFormat, writeStoredDetections, type StoredSet } from './name-detections.ts'

const { values } = parseArgs({ options: { set: { type: 'string', default: 'names-dev' }, misses: { type: 'boolean', default: false }, save: { type: 'boolean', default: false } } })
if (!(values.set in STORED_SETS)) throw new Error(`--set is one of: ${Object.keys(STORED_SETS).join(', ')}`)
const set = values.set as StoredSet
const { firstNames } = STORED_SETS[set]

const items = itemsOf(set)
const texts = items.map(item => item.text)
const run = await detectNamesInBrowser(texts, { firstNames })
const finder = (names: readonly Detection[][]) => {
  const byText = new Map(items.map((item, i) => [item.text, combined(item.text, detect(item.text), names[i]!)]))
  return (text: string) => byText.get(text) ?? []
}
const find = finder(run.detections)

const typeNames = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8')).typeMany as Record<PiiType, string>
const mistakes: Mistake[] = []
const scores = evaluate(items, find, mistakes)
console.log(`Name model ${NAME_MODEL.source}@${NAME_MODEL.revision.slice(0, 7)}, ${set}, ${items.length} texts, ${run.threads ? 'threads' : 'one thread'}, ${(run.milliseconds / 1000).toFixed(1)} s in Chromium\n`)
console.log(toMarkdown([{ name: `${set}: rules and name model`, scores }], typeNames))

// For the name set: the three recall columns, which need a second run without the first-name list.
if (set.startsWith('names') && firstNames) {
  const withoutList = await detectNamesInBrowser(texts, { firstNames: false })
  console.log(`\n${nameTables(items, find, finder(withoutList.detections)).replaceAll('(test split)', `(${set})`)}`)
}
if (set === 'long-texts') console.log(`\n${positionTable(items, find)}`)
if (values.misses) {
  const shown = mistakes.filter(mistake => mistake.type === 'NAME' || mistake.type === 'PLACE')
  const textOf = new Map(items.map(item => [item.id, item.text]))
  console.log(`\n${shown.length} names and places missed or wrong:`)
  for (const { id, kind, type, text } of shown) console.log(`  ${id}  ${kind.padEnd(6)}  ${type.padEnd(5)}  ${text.padEnd(28)}  ${textOf.get(id)}`)
}
if (values.save) {
  const stored = readStoredDetections()
  // Detections from another model revision are not kept: they would no longer be checked.
  const sets = stored?.model === NAME_MODEL.revision ? stored.sets : {}
  writeStoredDetections({ model: NAME_MODEL.revision, sets: { ...sets, [set]: storedFormat(items.map(item => item.id), run.detections) } })
  console.log(`\nSaved the detections for ${set}.`)
}
