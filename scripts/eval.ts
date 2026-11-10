// Measures how well Painfold finds the personal data labelled in data/eval/,
// per data type and language, for each evaluation set separately. Every text
// is checked by the rules (here) and the name model (measured in the browser
// and stored, see scripts/name-detections.ts), as in the app.
//
//   node scripts/eval.ts            print the tables as Markdown
//   node scripts/eval.ts --write    also update the numbers in docs/accuracy.md
//   node scripts/eval.ts --misses   list every missed value and wrong detection
//
// Rules:
// - A labelled value is found when detections of the same type cover all of
//   it: a value that is only partly removed still leaks.
// - A detection is correct when it overlaps a labelled value of its type.
// - "Removed by any type" counts a labelled value as removed when detections
//   of any type cover it, which is what matters for the cleaned file.
import { readFileSync, writeFileSync } from 'node:fs'
import { isFirstName } from '../core/detect/first-names.ts'
import { detect } from '../core/detect/index.ts'
import { combined } from '../core/detect/merge.ts'
import type { Detection } from '../core/detect/types.ts'
import { PII_TYPES, type PiiType } from '../core/pii-types.ts'
import { asDetections, readStoredDetections, STORED_SETS, type StoredDetections, type StoredSet } from './name-detections.ts'

export type Lang = 'de' | 'en'
// group and split exist only in the hand-written name set (see scripts/fake-data/names.ts).
export type EvalItem = { id: string, lang: Lang, group?: string, split?: 'dev' | 'test', text: string, spans: Array<{ start: number, end: number, type: PiiType, text: string }> }
export type Score = { labelled: number, found: number, detected: number, correct: number }
export type SetScores = { byType: Map<PiiType, Record<Lang, Score>>, anyType: Record<Lang, Score> }
export type Mistake = { id: string, kind: 'missed' | 'wrong', type: PiiType, text: string }

// The published sets and where their name detections are stored. The name
// set's dev split may be used to tune the detectors; only its test split is reported.
export const SETS: ReadonlyArray<{ name: string, stored: StoredSet }> = [
  { name: 'Generated', stored: 'generated' },
  { name: 'Hand-written hard cases', stored: 'hard-cases' },
  { name: 'Hand-written names (test split)', stored: 'names-test' },
]
export const NAMES_PATH = 'data/eval/names.jsonl'

// Labels for the name-origin groups in the published table, in the order of scripts/fake-data/names.ts.
export const GROUP_NAMES: Record<string, string> = {
  'german-speaking': 'German-speaking',
  'english': 'English',
  'bosnian-serbian-croatian': 'Bosnian, Serbian, Croatian',
  'turkish': 'Turkish',
  'romanian': 'Romanian',
  'hungarian': 'Hungarian',
  'polish': 'Polish',
  'ukrainian': 'Ukrainian',
  'arabic': 'Arabic',
  'afghan': 'Afghan',
  'african': 'African',
  'south-asian': 'South Asian',
  'east-asian': 'East Asian',
}
export const LANGS: readonly Lang[] = ['de', 'en']
// The Stage 2 target, for removal recall of names in every name-origin group.
export const NAME_RECALL_TARGET = 0.9

const emptyScore = (): Score => ({ labelled: 0, found: 0, detected: 0, correct: 0 })
const perLang = (): Record<Lang, Score> => ({ de: emptyScore(), en: emptyScore() })

/** Whether the ranges together cover start to end without a gap. */
export function covers(ranges: ReadonlyArray<{ start: number, end: number }>, start: number, end: number): boolean {
  let reached = start
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.start > reached) break
    reached = Math.max(reached, range.end)
    if (reached >= end) return true
  }
  return reached >= end
}

const overlaps = (a: { start: number, end: number }, b: { start: number, end: number }) => a.start < b.end && b.start < a.end

export function evaluate(items: readonly EvalItem[], find: (text: string) => Detection[] = detect, mistakes: Mistake[] = []): SetScores {
  const byType = new Map(PII_TYPES.map(type => [type, perLang()]))
  const anyType = perLang()
  for (const item of items) {
    const detections = find(item.text)
    for (const span of item.spans) {
      const score = byType.get(span.type)![item.lang]
      score.labelled++
      if (covers(detections.filter(found => found.type === span.type), span.start, span.end)) score.found++
      else mistakes.push({ id: item.id, kind: 'missed', type: span.type, text: span.text })
      anyType[item.lang].labelled++
      if (covers(detections, span.start, span.end)) anyType[item.lang].found++
    }
    for (const found of detections) {
      const score = byType.get(found.type)![item.lang]
      score.detected++
      if (item.spans.some(span => span.type === found.type && overlaps(span, found))) score.correct++
      else mistakes.push({ id: item.id, kind: 'wrong', type: found.type, text: found.value })
      anyType[item.lang].detected++
      if (item.spans.some(span => overlaps(span, found))) anyType[item.lang].correct++
    }
  }
  return { byType, anyType }
}

const ratio = (part: number, whole: number) => (whole === 0 ? '–' : (part / whole).toFixed(2))

function row(label: string, scores: Record<Lang, Score>): string {
  const cells = LANGS.flatMap(lang => [ratio(scores[lang].found, scores[lang].labelled), ratio(scores[lang].correct, scores[lang].detected), String(scores[lang].labelled)])
  return `| ${label} | ${cells.join(' | ')} |`
}

/** One Markdown table per set: recall, precision and the number of labelled values, per language. */
export function toMarkdown(results: ReadonlyArray<{ name: string, scores: SetScores }>, typeNames: Record<PiiType, string>): string {
  return results.map(({ name, scores }) => [
    `**${name}**`,
    '',
    '| Data type | DE recall | DE precision | DE values | EN recall | EN precision | EN values |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...PII_TYPES
      .filter(type => LANGS.some(lang => scores.byType.get(type)![lang].labelled + scores.byType.get(type)![lang].detected > 0))
      .map(type => row(typeNames[type], scores.byType.get(type)!)),
    row('**Removed by any type**', scores.anyType),
  ].join('\n')).join('\n\n')
}

export function readItems(path: string, split?: 'dev' | 'test'): EvalItem[] {
  const items = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as EvalItem)
  return split ? items.filter(item => item.split === split) : items
}

export type GroupRecall = { group: string, scores: Record<Lang, Pick<Score, 'labelled' | 'found'>> }

/**
 * Name recall per name-origin group and language: the share of labelled names
 * that NAME detections cover completely (type-correct), or, with anyType, that
 * detections of any type cover (removal recall: the name is removed even if it
 * was labelled a place).
 */
export function nameRecallByGroup(items: readonly EvalItem[], find: (text: string) => Detection[] = detect, { anyType = false }: { anyType?: boolean } = {}): GroupRecall[] {
  const groups = new Map<string, Record<Lang, Pick<Score, 'labelled' | 'found'>>>()
  for (const item of items) {
    if (!item.group) continue
    const scores = groups.get(item.group) ?? { de: { labelled: 0, found: 0 }, en: { labelled: 0, found: 0 } }
    const names = find(item.text).filter(found => anyType || found.type === 'NAME')
    for (const span of item.spans.filter(span => span.type === 'NAME')) {
      scores[item.lang].labelled++
      if (covers(names, span.start, span.end)) scores[item.lang].found++
    }
    groups.set(item.group, scores)
  }
  return [...groups].map(([group, scores]) => ({ group, scores }))
}

type Counts = Pick<Score, 'labelled' | 'found'>
const sum = (...counts: Counts[]): Counts => ({ labelled: counts.reduce((total, c) => total + c.labelled, 0), found: counts.reduce((total, c) => total + c.found, 0) })
const both = (scores: Record<Lang, Counts>) => sum(scores.de, scores.en)
const belowTarget = (counts: Counts) => (counts.labelled > 0 && counts.found / counts.labelled < NAME_RECALL_TARGET ? ' (below target)' : '')

/**
 * Name recall three ways, per language and per name-origin group: removal
 * recall (the name was removed, whatever type it got; the target applies to
 * this one), type-correct recall (removed and labelled a name), and removal
 * recall without the first-name list. Then how many names contain a first
 * name from the list.
 */
export function nameTables(items: readonly EvalItem[], find: (text: string) => Detection[], findWithoutList: (text: string) => Detection[]): string {
  const byGroup = (results: GroupRecall[]) => new Map(results.map(result => [result.group, result.scores]))
  const removal = byGroup(nameRecallByGroup(items, find, { anyType: true }))
  const typed = byGroup(nameRecallByGroup(items, find))
  const withoutList = byGroup(nameRecallByGroup(items, findWithoutList, { anyType: true }))
  const groups = [...removal.keys()]
  const total = (scores: Map<string, Record<Lang, Counts>>, lang?: Lang) => sum(...groups.map(group => (lang ? scores.get(group)![lang] : both(scores.get(group)!))))
  const cell = (counts: Counts) => ratio(counts.found, counts.labelled)

  const names = items.flatMap(item => item.spans.filter(span => span.type === 'NAME'))
  const onList = names.filter(span => span.text.split(/[\s-]+/).some(word => isFirstName(word)))
  return [
    `**Name recall (test split).** Removal: the name was removed, whatever type it got. Type-correct: removed and labelled a name. Without the list: removal recall without the first-name list. Target: ${NAME_RECALL_TARGET.toFixed(2)} removal recall.`,
    '',
    '| Language | Removal | Type-correct | Without the list | Names |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...[...LANGS, undefined].map((lang) => {
      const counts = total(removal, lang)
      return `| ${lang ? lang.toUpperCase() : '**Both**'} | ${cell(counts)}${belowTarget(counts)} | ${cell(total(typed, lang))} | ${cell(total(withoutList, lang))} | ${counts.labelled} |`
    }),
    '',
    '**Name recall by name-origin group (test split).** The group exists only in the evaluation data; Painfold never infers anyone\'s origin.',
    '',
    '| Name-origin group | DE removal | DE type-correct | DE without the list | EN removal | EN type-correct | EN without the list | Removal | Type-correct | Without the list | Names |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...groups.map((group) => {
      const [r, t, w] = [removal.get(group)!, typed.get(group)!, withoutList.get(group)!]
      return `| ${GROUP_NAMES[group] ?? group} | ${cell(r.de)} | ${cell(t.de)} | ${cell(w.de)} | ${cell(r.en)} | ${cell(t.en)} | ${cell(w.en)} | ${cell(both(r))}${belowTarget(both(r))} | ${cell(both(t))} | ${cell(both(w))} | ${both(r).labelled} |`
    }),
    '',
    `**The first-name list (test split).** ${onList.length} of ${names.length} test names contain a first name from the list. It is used only right after a greeting, title, thank-you, sign-off or introduction.`,
  ].join('\n')
}

/** Finds detections for a set's texts: the rules, plus the name model's stored browser detections outside them, as in the review. */
export function finderFor(set: StoredSet, items: readonly EvalItem[], stored: StoredDetections | undefined = readStoredDetections()): (text: string) => Detection[] {
  const names = stored?.sets[set]
  if (!names) throw new Error(`No stored name detections for ${set}. Run \`npm run eval:names -- --set ${set} --save\`.`)
  const byText = new Map(items.map(item => [item.text, combined(item.text, detect(item.text), asDetections(item.text, names[item.id]))]))
  return text => byText.get(text) ?? []
}

/** The items of a stored set. */
export const itemsOf = (set: StoredSet): EvalItem[] => {
  const { path, ...rest } = STORED_SETS[set]
  return readItems(path, 'split' in rest ? rest.split : undefined)
}

export const ACCURACY_PATH = 'docs/accuracy.md'
const START = '<!-- accuracy:start -->'
const END = '<!-- accuracy:end -->'

/** The accuracy page with the text between its markers replaced. */
export function withAccuracy(readme: string, tables: string): string {
  const start = readme.indexOf(START)
  const end = readme.indexOf(END)
  if (start === -1 || end < start) throw new Error(`${ACCURACY_PATH} needs ${START} and ${END}`)
  return `${readme.slice(0, start + START.length)}\n${tables}\n${readme.slice(end)}`
}

export function currentTables(stored: StoredDetections | undefined = readStoredDetections()): string {
  const typeNames = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8')).typeMany as Record<PiiType, string>
  const sets = toMarkdown(SETS.map((set) => {
    const items = itemsOf(set.stored)
    return { name: set.name, scores: evaluate(items, finderFor(set.stored, items, stored)) }
  }), typeNames)
  const test = itemsOf('names-test')
  return `${sets}\n\n${nameTables(test, finderFor('names-test', test, stored), finderFor('names-test-without-list', test, stored))}`
}

if (import.meta.main) {
  const tables = currentTables()
  console.log(tables)
  if (process.argv.includes('--misses')) {
    for (const set of SETS) {
      const mistakes: Mistake[] = []
      const items = itemsOf(set.stored)
      evaluate(items, finderFor(set.stored, items), mistakes)
      console.log(`\n${set.name}: ${mistakes.length} mistakes`)
      for (const { id, kind, type, text } of mistakes) console.log(`  ${id}  ${kind.padEnd(6)}  ${type.padEnd(13)}  ${text}`)
    }
  }
  if (process.argv.includes('--write')) writeFileSync(ACCURACY_PATH, withAccuracy(readFileSync(ACCURACY_PATH, 'utf8'), tables))
}
