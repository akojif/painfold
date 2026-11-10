// Measures how well the detectors find the personal data labelled in
// data/eval/, per data type and language, for the generated items and the
// hand-written hard cases separately.
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
//   of any type cover it, which is what matters for the cleaned file. It is
//   reported with and without names and places, which v0.1 does not detect.
import { readFileSync, writeFileSync } from 'node:fs'
import { detect } from '../core/detect/index.ts'
import type { Detection } from '../core/detect/types.ts'
import { PII_TYPES, type PiiType } from '../core/pii-types.ts'

export type Lang = 'de' | 'en'
// group and split exist only in the hand-written name set (see scripts/fake-data/names.ts).
export type EvalItem = { id: string, lang: Lang, group?: string, split?: 'dev' | 'test', text: string, spans: Array<{ start: number, end: number, type: PiiType, text: string }> }
export type Score = { labelled: number, found: number, detected: number, correct: number }
export type SetScores = { byType: Map<PiiType, Record<Lang, Score>>, anyType: Record<Lang, Score>, anyDetectedType: Record<Lang, Score> }
export type Mistake = { id: string, kind: 'missed' | 'wrong', type: PiiType, text: string }

// The name set's dev split may be used to tune the detectors; only its test split is reported.
export const SETS: ReadonlyArray<{ name: string, path: string, split?: 'test' }> = [
  { name: 'Generated', path: 'data/eval/generated.jsonl' },
  { name: 'Hand-written hard cases', path: 'data/eval/hard-cases.jsonl' },
  { name: 'Hand-written names (test split)', path: 'data/eval/names.jsonl', split: 'test' },
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
// Detected from Stage 2; the Stage 2 target is recorded here so it is checked against these numbers.
export const NOT_DETECTED_YET: readonly PiiType[] = ['NAME', 'PLACE']
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
  const anyDetectedType = perLang()
  for (const item of items) {
    const detections = find(item.text)
    for (const span of item.spans) {
      const score = byType.get(span.type)![item.lang]
      score.labelled++
      if (covers(detections.filter(found => found.type === span.type), span.start, span.end)) score.found++
      else mistakes.push({ id: item.id, kind: 'missed', type: span.type, text: span.text })
      const removed = covers(detections, span.start, span.end)
      for (const total of NOT_DETECTED_YET.includes(span.type) ? [anyType] : [anyType, anyDetectedType]) {
        total[item.lang].labelled++
        if (removed) total[item.lang].found++
      }
    }
    for (const found of detections) {
      const score = byType.get(found.type)![item.lang]
      score.detected++
      if (item.spans.some(span => span.type === found.type && overlaps(span, found))) score.correct++
      else mistakes.push({ id: item.id, kind: 'wrong', type: found.type, text: found.value })
      const correct = item.spans.some(span => overlaps(span, found))
      for (const total of [anyType, anyDetectedType]) {
        total[item.lang].detected++
        if (correct) total[item.lang].correct++
      }
    }
  }
  return { byType, anyType, anyDetectedType }
}

const ratio = (part: number, whole: number) => (whole === 0 ? '–' : (part / whole).toFixed(2))

function row(label: string, scores: Record<Lang, Score>, note = ''): string {
  const cells = LANGS.flatMap(lang => [ratio(scores[lang].found, scores[lang].labelled), ratio(scores[lang].correct, scores[lang].detected), String(scores[lang].labelled)])
  return `| ${label}${note} | ${cells.join(' | ')} |`
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
      .map(type => row(typeNames[type], scores.byType.get(type)!, NOT_DETECTED_YET.includes(type) ? ' (from v0.2)' : '')),
    row('**Removed by any type**', scores.anyType),
    row('**Removed by any type, without names and places**', scores.anyDetectedType),
  ].join('\n')).join('\n\n')
}

export function readItems(path: string, split?: 'dev' | 'test'): EvalItem[] {
  const items = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as EvalItem)
  return split ? items.filter(item => item.split === split) : items
}

export type GroupRecall = { group: string, scores: Record<Lang, Pick<Score, 'labelled' | 'found'>> }

/** Name recall per name-origin group and language: the share of labelled names that NAME detections cover completely. */
export function nameRecallByGroup(items: readonly EvalItem[], find: (text: string) => Detection[] = detect): GroupRecall[] {
  const groups = new Map<string, Record<Lang, Pick<Score, 'labelled' | 'found'>>>()
  for (const item of items) {
    if (!item.group) continue
    const scores = groups.get(item.group) ?? { de: { labelled: 0, found: 0 }, en: { labelled: 0, found: 0 } }
    const names = find(item.text).filter(found => found.type === 'NAME')
    for (const span of item.spans.filter(span => span.type === 'NAME')) {
      scores[item.lang].labelled++
      if (covers(names, span.start, span.end)) scores[item.lang].found++
    }
    groups.set(item.group, scores)
  }
  return [...groups].map(([group, scores]) => ({ group, scores }))
}

/** The per-group table: recall in each language and overall, marking groups below the target. */
export function groupMarkdown(results: readonly GroupRecall[], split: 'dev' | 'test' = 'test'): string {
  const cell = (s: Pick<Score, 'labelled' | 'found'>) => `${ratio(s.found, s.labelled)} | ${s.labelled}`
  return [
    `**Name recall by name-origin group (${split} split).** Target: ${NAME_RECALL_TARGET.toFixed(2)} for every group. The group exists only in the evaluation data; Painfold never infers anyone's origin.`,
    '',
    '| Name-origin group | DE recall | DE names | EN recall | EN names | Recall | Names |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map(({ group, scores }) => {
      const all = { labelled: scores.de.labelled + scores.en.labelled, found: scores.de.found + scores.en.found }
      return `| ${GROUP_NAMES[group] ?? group} | ${cell(scores.de)} | ${cell(scores.en)} | ${cell(all)} |`
    }),
  ].join('\n')
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

export function currentTables(): string {
  const typeNames = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8')).typeMany as Record<PiiType, string>
  const sets = toMarkdown(SETS.map(set => ({ name: set.name, scores: evaluate(readItems(set.path, set.split)) })), typeNames)
  return `${sets}\n\n${groupMarkdown(nameRecallByGroup(readItems(NAMES_PATH, 'test')))}`
}

if (import.meta.main) {
  const tables = currentTables()
  console.log(tables)
  if (process.argv.includes('--misses')) {
    for (const set of SETS) {
      const mistakes: Mistake[] = []
      evaluate(readItems(set.path, set.split), detect, mistakes)
      console.log(`\n${set.name}: ${mistakes.length} mistakes`)
      for (const { id, kind, type, text } of mistakes.filter(mistake => !NOT_DETECTED_YET.includes(mistake.type))) console.log(`  ${id}  ${kind.padEnd(6)}  ${type.padEnd(13)}  ${text}`)
    }
  }
  if (process.argv.includes('--write')) writeFileSync(ACCURACY_PATH, withAccuracy(readFileSync(ACCURACY_PATH, 'utf8'), tables))
}
