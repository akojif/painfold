// Measures the warnings for indirect identifiers (core/detect/indirect/) on a
// hand-written set of invented feedback, data/eval/indirect.jsonl: exact ages,
// "the only …", job titles with a place and unique roles, in German and
// English, with traps that must not warn (durations, versions, the age of
// things, "the only problem", a role mentioned in passing).
//
// The places in each text are given, as the name model would find them, so
// the numbers measure the warning rules, not the model. The dev split is for
// tuning; the test split was run once, after tuning, and is what is published.
//
// A labelled warning counts as found when a warning of the same type (AGE or
// ROLE) covers part of it. A warning shown is correct when it covers part of a
// labelled one of the same type.
import { readFileSync } from 'node:fs'
import { findIndirect, type IndirectReason } from '../core/detect/indirect/index.ts'
import type { Detection } from '../core/detect/types.ts'
import { readMessages, type Messages } from '../i18n/messages.ts'
import type { Lang, Score } from './eval.ts'

export const INDIRECT_PATH = 'data/eval/indirect.jsonl'
export const REASONS: readonly IndirectReason[] = ['age', 'only', 'role-place', 'unique-role']

type Span = { start: number, end: number }
export type IndirectItem = {
  id: string
  lang: Lang
  split: 'dev' | 'test'
  text: string
  places: Array<Span & { value: string }>
  warnings: Array<Span & { reason: IndirectReason, text: string }>
}

const TYPE: Record<IndirectReason, 'AGE' | 'ROLE'> = { 'age': 'AGE', 'only': 'ROLE', 'role-place': 'ROLE', 'unique-role': 'ROLE' }
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end
const empty = (): Score => ({ labelled: 0, found: 0, detected: 0, correct: 0 })

export function readIndirect(split?: 'dev' | 'test'): IndirectItem[] {
  return readFileSync(INDIRECT_PATH, 'utf8').trim().split('\n').map(line => JSON.parse(line) as IndirectItem)
    .filter(item => !split || item.split === split)
}

export type IndirectMistake = { id: string, kind: 'missed' | 'wrong', reason: IndirectReason, text: string }

/** Scores per kind and language; mistakes are collected for --misses. */
export function evaluateIndirect(items: readonly IndirectItem[], mistakes: IndirectMistake[] = []): Record<IndirectReason, Record<Lang, Score>> {
  const scores = Object.fromEntries(REASONS.map(reason => [reason, { de: empty(), en: empty() }])) as Record<IndirectReason, Record<Lang, Score>>
  for (const item of items) {
    const places: Detection[] = item.places.map(place => ({ type: 'PLACE', ...place }))
    const shown = findIndirect(item.text, places)
    for (const labelled of item.warnings) {
      const score = scores[labelled.reason][item.lang]
      score.labelled++
      if (shown.some(warning => warning.type === TYPE[labelled.reason] && overlaps(warning, labelled))) score.found++
      else mistakes.push({ id: item.id, kind: 'missed', reason: labelled.reason, text: labelled.text })
    }
    for (const warning of shown) {
      const score = scores[warning.reason][item.lang]
      score.detected++
      if (item.warnings.some(labelled => TYPE[labelled.reason] === warning.type && overlaps(warning, labelled))) score.correct++
      else mistakes.push({ id: item.id, kind: 'wrong', reason: warning.reason, text: warning.value })
    }
  }
  return scores
}

const ratio = (part: number, whole: number) => (whole === 0 ? '–' : (part / whole).toFixed(2))
const LANGS: readonly Lang[] = ['de', 'en']

/** The published table, in the same form as the other sets: recall, precision and labelled warnings per kind and language. */
export function indirectTable(scores: Record<IndirectReason, Record<Lang, Score>>, kindNames: Record<IndirectReason, string>): string {
  return [
    '**Could identify someone (indirect identifiers, test split)**',
    '',
    '| Kind | DE recall | DE precision | DE warnings | EN recall | EN precision | EN warnings |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...REASONS.map((reason) => {
      const cells = LANGS.flatMap(lang => [ratio(scores[reason][lang].found, scores[reason][lang].labelled), ratio(scores[reason][lang].correct, scores[reason][lang].detected), String(scores[reason][lang].labelled)])
      return `| ${kindNames[reason]} | ${cells.join(' | ')} |`
    }),
  ].join('\n')
}

if (import.meta.main) {
  const split = process.argv.includes('--test') ? 'test' : 'dev'
  const mistakes: IndirectMistake[] = []
  const scores = evaluateIndirect(readIndirect(split), mistakes)
  const names = (readMessages('en').warning as Messages).kind as Record<IndirectReason, string>
  console.log(`Split: ${split}\n`)
  console.log(indirectTable(scores, names))
  console.log(`\n${mistakes.length} mistakes`)
  for (const { id, kind, reason, text } of mistakes) console.log(`  ${id}  ${kind.padEnd(6)}  ${reason.padEnd(11)}  ${text}`)
}
