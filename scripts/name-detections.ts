// What the name model found in each evaluation set, measured once in the
// browser (scripts/eval-browser.ts, `npm run eval:names -- --set <set> --save`)
// and stored, so the published numbers are computed from real browser runs
// (scripts/eval.ts) and an end-to-end test can check they still match
// (tests/e2e/name-eval.spec.ts). One line per text keeps the diffs readable.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Detection } from '../core/detect/types.ts'

export const DETECTIONS_PATH = 'data/eval/name-detections.json'

// Each stored set: where its texts come from, and whether the first-name list
// was used. names-dev is for tuning; everything else is only reported.
export const STORED_SETS = {
  'generated': { path: 'data/eval/generated.jsonl', firstNames: true },
  'hard-cases': { path: 'data/eval/hard-cases.jsonl', firstNames: true },
  'names-dev': { path: 'data/eval/names.jsonl', split: 'dev', firstNames: true },
  'names-test': { path: 'data/eval/names.jsonl', split: 'test', firstNames: true },
  'names-test-without-list': { path: 'data/eval/names.jsonl', split: 'test', firstNames: false },
} as const satisfies Record<string, { path: string, split?: 'dev' | 'test', firstNames: boolean }>
export type StoredSet = keyof typeof STORED_SETS

export type StoredSpan = Pick<Detection, 'type' | 'start' | 'end'>
export type StoredDetections = { model: string, sets: Partial<Record<StoredSet, Record<string, StoredSpan[]>>> }

export function readStoredDetections(): StoredDetections | undefined {
  return existsSync(DETECTIONS_PATH) ? JSON.parse(readFileSync(DETECTIONS_PATH, 'utf8')) as StoredDetections : undefined
}

export function storedFormat(ids: readonly string[], detections: readonly Detection[][]): Record<string, StoredSpan[]> {
  return Object.fromEntries(ids.map((id, i) => [id, detections[i]!.map(({ type, start, end }) => ({ type, start, end }))]))
}

/** Stored spans as detections of the given text. */
export function asDetections(text: string, spans: readonly StoredSpan[] = []): Detection[] {
  return spans.map(span => ({ ...span, value: text.slice(span.start, span.end) }))
}

export function writeStoredDetections(stored: StoredDetections): void {
  const set = (entries: Record<string, unknown>) => `{\n${Object.entries(entries).map(([id, list]) => `      ${JSON.stringify(id)}: ${JSON.stringify(list)}`).join(',\n')}\n    }`
  const sets = (Object.keys(STORED_SETS) as StoredSet[]).filter(name => stored.sets[name]).map(name => `    ${JSON.stringify(name)}: ${set(stored.sets[name]!)}`).join(',\n')
  writeFileSync(DETECTIONS_PATH, `{\n  "model": ${JSON.stringify(stored.model)},\n  "sets": {\n${sets}\n  }\n}\n`)
}
