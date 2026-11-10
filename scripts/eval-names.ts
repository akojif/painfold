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
import { isFirstName } from '../core/detect/first-names.ts'
import type { Detection } from '../core/detect/types.ts'
import { detectNamesInBrowser, readStoredDetections, storedFormat, writeStoredDetections } from './eval-browser.ts'
import { covers, evaluate, GROUP_NAMES, LANGS, NAME_RECALL_TARGET, nameRecallByGroup, NAMES_PATH, readItems, toMarkdown, type EvalItem, type GroupRecall, type Lang, type Mistake } from './eval.ts'
import { readFileSync } from 'node:fs'
import type { PiiType } from '../core/pii-types.ts'

const { values } = parseArgs({ options: { split: { type: 'string', default: 'dev' }, misses: { type: 'boolean', default: false }, save: { type: 'boolean', default: false } } })
if (values.split !== 'dev' && values.split !== 'test') throw new Error('--split is dev or test')
const split = values.split

const items = readItems(NAMES_PATH, split)
const texts = items.map(item => item.text)
const run = await detectNamesInBrowser(texts)
const withoutList = await detectNamesInBrowser(texts, { firstNames: false })
// As in the app: the rules and the name model together.
const finder = (names: readonly Detection[][]) => {
  const byText = new Map(items.map((item, i) => [item.text, [...detect(item.text), ...names[i]!]]))
  return (text: string) => byText.get(text) ?? []
}
const find = finder(run.detections)
const findWithoutList = finder(withoutList.detections)

const typeNames = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8')).typeMany as Record<PiiType, string>
const mistakes: Mistake[] = []
const scores = evaluate(items, find, mistakes)

console.log(`Name model ${MODEL_PATH}, ${items.length} texts, ${split} split, ${run.threads ? 'threads' : 'one thread'}, ${(run.milliseconds / 1000).toFixed(1)} s in Chromium\n`)
console.log(toMarkdown([{ name: `Hand-written names (${split} split), rules and name model`, scores }], typeNames))

// Name recall two ways: removal (removed, whatever type it got: a name labelled
// a place is still protected) and type-correct (removed and labelled a name).
// The target applies to removal recall.
type Counts = { labelled: number, found: number }
const ratio = ({ found, labelled }: Counts) => (labelled === 0 ? '–' : (found / labelled).toFixed(2))
const sum = (...counts: Counts[]) => ({ labelled: counts.reduce((total, c) => total + c.labelled, 0), found: counts.reduce((total, c) => total + c.found, 0) })
const byGroup = (results: GroupRecall[]) => new Map(results.map(result => [result.group, result.scores]))
const removal = byGroup(nameRecallByGroup(items, find, { anyType: true }))
const typed = byGroup(nameRecallByGroup(items, find))
const removalWithoutList = byGroup(nameRecallByGroup(items, findWithoutList, { anyType: true }))
const groups = [...removal.keys()]
const perLang = (scores: Map<string, Record<Lang, Counts>>, lang?: Lang) => sum(...groups.map(group => (lang ? scores.get(group)![lang] : sum(scores.get(group)!.de, scores.get(group)!.en))))
const flag = (counts: Counts) => (counts.labelled > 0 && counts.found / counts.labelled < NAME_RECALL_TARGET ? ' (below target)' : '')

console.log(`\n**Name recall (${split} split).** Removal recall: the name was removed, whatever type it got. Type-correct: removed and labelled a name. Target ${NAME_RECALL_TARGET.toFixed(2)} for removal recall.\n`)
console.log('| Language | Names | Removal recall | Type-correct recall | Removal recall without the first-name list |')
console.log('| --- | ---: | ---: | ---: | ---: |')
for (const lang of [...LANGS, undefined]) {
  const counts = perLang(removal, lang)
  console.log(`| ${lang?.toUpperCase() ?? 'Both'} | ${counts.labelled} | ${ratio(counts)}${flag(counts)} | ${ratio(perLang(typed, lang))} | ${ratio(perLang(removalWithoutList, lang))} |`)
}

console.log(`\n**Name recall by name-origin group (${split} split).** The group exists only in the evaluation data; Painfold never infers anyone's origin.\n`)
console.log('| Name-origin group | DE removal | DE type-correct | DE names | EN removal | EN type-correct | EN names | Removal | Type-correct | Without the list | Names |')
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const group of groups) {
  const [r, t, w] = [removal.get(group)!, typed.get(group)!, removalWithoutList.get(group)!]
  const all = sum(r.de, r.en)
  console.log(`| ${GROUP_NAMES[group] ?? group} | ${ratio(r.de)} | ${ratio(t.de)} | ${r.de.labelled} | ${ratio(r.en)} | ${ratio(t.en)} | ${r.en.labelled} | ${ratio(all)}${flag(all)} | ${ratio(sum(t.de, t.en))} | ${ratio(sum(w.de, w.en))} | ${all.labelled} |`)
}

// How much the first-name list could have helped: names that contain a listed
// first name, and names that were removed only because of the list.
const labelledNames = (list: readonly EvalItem[]) => list.flatMap(item => item.spans.filter(span => span.type === 'NAME').map(span => ({ item, span })))
const all = labelledNames(items)
const onList = all.filter(({ span }) => span.text.split(/[\s-]+/).some(word => isFirstName(word)))
const removedBy = (finder: (text: string) => Detection[]) => ({ item, span }: { item: EvalItem, span: { start: number, end: number } }) => covers(finder(item.text), span.start, span.end)
const onlyThroughList = all.filter(name => removedBy(find)(name) && !removedBy(findWithoutList)(name))
console.log(`\n**The first-name list (${split} split).** ${onList.length} of ${all.length} names (${(onList.length / all.length * 100).toFixed(0)} %) contain a first name from the list. ${onlyThroughList.length} names were removed only because of the list${onlyThroughList.length ? `: ${onlyThroughList.map(({ span }) => span.text).join(', ')}` : ''}.`)

const places = (finder: (text: string) => Detection[], anyType: boolean) => {
  const counts = { de: { labelled: 0, found: 0 }, en: { labelled: 0, found: 0 } }
  for (const item of items) for (const span of item.spans.filter(span => span.type === 'PLACE')) {
    counts[item.lang].labelled++
    if (covers(finder(item.text).filter(found => anyType || found.type === 'PLACE'), span.start, span.end)) counts[item.lang].found++
  }
  return counts
}
const placesRemoved = places(find, true)
const placesTyped = places(find, false)
console.log(`\n**Places (${split} split).** Removal recall DE ${ratio(placesRemoved.de)}, EN ${ratio(placesRemoved.en)} (type-correct DE ${ratio(placesTyped.de)}, EN ${ratio(placesTyped.en)}), of ${placesRemoved.de.labelled} and ${placesRemoved.en.labelled} places.`)
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
