// Name and place accuracy, measured in the browser (scripts/eval-browser.ts).
//
//   npm run eval:names              the dev split: tune against this one
//   npm run eval:names -- --misses  also list every missed and wrong name or place
//   npm run eval:names -- --split test
//   npm run eval:names -- --save    store the split's detections in data/eval/name-detections.json
//
// Each text is checked by the rules and the name model together, as in the
// app. The dev split (and its look-alikes: greetings followed by words that
// are not names) may be used to tune the name rules; the test split is only
// ever reported, never tuned against.
import { parseArgs } from 'node:util'
import { detect } from '../core/detect/index.ts'
import { MODEL_PATH, NAME_MODEL } from '../deploy/model.ts'
import { detectNamesInBrowser, readStoredDetections, storedFormat, writeStoredDetections } from './eval-browser.ts'
import { evaluate, groupMarkdown, nameRecallByGroup, NAMES_PATH, readItems, toMarkdown, type Mistake } from './eval.ts'
import { readFileSync } from 'node:fs'
import type { PiiType } from '../core/pii-types.ts'

const { values } = parseArgs({ options: { split: { type: 'string', default: 'dev' }, misses: { type: 'boolean', default: false }, save: { type: 'boolean', default: false } } })
if (values.split !== 'dev' && values.split !== 'test') throw new Error('--split is dev or test')
const split = values.split

const items = readItems(NAMES_PATH, split)
const run = await detectNamesInBrowser(items.map(item => item.text))
const byText = new Map(items.map((item, i) => [item.text, [...detect(item.text), ...run.detections[i]!]]))
const find = (text: string) => byText.get(text) ?? []

const typeNames = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8')).typeMany as Record<PiiType, string>
const mistakes: Mistake[] = []
const scores = evaluate(items, find, mistakes)

console.log(`Name model ${MODEL_PATH}, ${items.length} texts, ${split} split, ${run.threads ? 'threads' : 'one thread'}, ${(run.milliseconds / 1000).toFixed(1)} s in Chromium\n`)
console.log(toMarkdown([{ name: `Hand-written names (${split} split), rules and name model`, scores }], typeNames))
console.log(`\n${groupMarkdown(nameRecallByGroup(items, find), split)}`)
if (values.misses) {
  const shown = mistakes.filter(mistake => mistake.type === 'NAME' || mistake.type === 'PLACE')
  console.log(`\n${shown.length} names and places missed or wrong:`)
  const textOf = new Map(items.map(item => [item.id, item.text]))
  for (const { id, kind, type, text } of shown) console.log(`  ${id}  ${kind.padEnd(6)}  ${type.padEnd(5)}  ${text.padEnd(28)}  ${textOf.get(id)}`)
}

if (values.save) {
  const stored = readStoredDetections()
  // Detections from another model revision are not kept: they would no longer be checked.
  const splits = stored?.model === NAME_MODEL.revision ? stored.splits : {}
  writeStoredDetections({ model: NAME_MODEL.revision, splits: { ...splits, [split]: storedFormat(items.map(item => item.id), run.detections) } })
  console.log(`\nSaved the ${split} split's detections.`)
}
