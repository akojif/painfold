// The generated parts of data/eval/analysis/runs-log.md (#129). The log keeps
// hand-written notes, and between markers, tables computed from the stored
// runs: what each run was made with, what it cost, how it scored, and where
// the possible label gaps (data/eval/analysis/label-gaps.json) were seen.
// No number in those tables is typed by hand. `npm run eval:analysis -- --write`
// rewrites them, and a unit test fails when the committed log is out of date.
import { createHash } from 'node:crypto'
import { PRICES } from '../core/ai/cost.ts'
import type { Kind } from '../core/ai/merge.ts'
import type { ItemPrediction, Rate } from './analysis-metrics.ts'
import type { AnalysisResults } from './analysis-results.ts'
import type { EvalRun } from './analysis-runs.ts'

export const RUNS_LOG_PATH = 'data/eval/analysis/runs-log.md'
export const LABEL_GAPS_PATH = 'data/eval/analysis/label-gaps.json'

/** An item where the run found something the labels do not have, and the text looks like it says it: written by hand. */
export type LabelGap = { id: string, kind: Kind, found: string, why: string }

type Stored = { file: string, run: EvalRun }
const LANGUAGE = { en: 'English', de: 'German' } as const
const BLOCKS = ['runs', 'scores', 'gaps'] as const
type Block = typeof BLOCKS[number]

/** A short SHA-256 of the instructions sent, tagging and merging: the prompt version of a run. */
export const promptHash = (payload: EvalRun['payload']) =>
  createHash('sha256').update(JSON.stringify([payload.instructions, payload.mergeInstructions, null])).digest('hex').slice(0, 12)

const number = (value: number) => value.toLocaleString('en-US')
const percent = (rate: Rate) => (rate.of === 0 ? 'n/a' : `${Math.round((rate.hits / rate.of) * 100)}% (${rate.hits}/${rate.of})`)
const cost = (run: EvalRun) => {
  const price = PRICES[run.model]
  return price ? `$${((run.usage.input * price.input + run.usage.output * price.output) / 1_000_000).toFixed(4)}` : 'n/a'
}
const table = (head: readonly string[], rows: ReadonlyArray<readonly string[]>) =>
  [head, head.map(() => '---'), ...rows].map(row => `| ${row.join(' | ')} |`).join('\n')

/** Runs in the order they were made, numbered per split and language: dev 1, dev 2… */
export function numberedRuns(runs: readonly Stored[]): Array<Stored & { label: string, n: number }> {
  const sorted = [...runs].sort((a, b) => a.run.createdAt.localeCompare(b.run.createdAt) || a.file.localeCompare(b.file))
  const counts = new Map<string, number>()
  return sorted.map((entry) => {
    const key = `${entry.run.split}|${entry.run.lang}`
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    return { ...entry, n, label: `${entry.run.split} ${n}` }
  })
}

/** "runs 1, 2 and 4", or "none". */
const seenIn = (numbers: readonly number[]) => {
  if (numbers.length === 0) return 'none'
  if (numbers.length === 1) return `run ${numbers[0]}`
  return `runs ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`
}

/** The text of each generated block. `predictions` holds each run's replayed predictions, by file. */
export function runsLogBlocks(runs: readonly Stored[], results: AnalysisResults, predictions: ReadonlyMap<string, readonly ItemPrediction[]>, gaps: readonly LabelGap[]): Record<Block, string> {
  const numbered = numberedRuns(runs)
  const scored = new Map(results.runs.map(run => [run.file, run]))

  const runRows = numbered.map(({ file, run, label }) => [
    label,
    LANGUAGE[run.lang],
    `\`${file}\``,
    `\`${run.commit}\``,
    `\`${run.model}\``,
    `\`${promptHash(run.payload)}\``,
    `effort ${run.settings.effort}, at most ${number(run.settings.maxTokens)} tokens out, batches of ${run.settings.batchSize}`,
    number(run.payload.texts.length),
    number(run.tagging.length + run.merge.length),
    number(run.usage.input),
    number(run.usage.output),
    cost(run),
    run.durationMs === undefined ? 'not recorded' : `${Math.round(run.durationMs / 1000)} s`,
  ])
  const runsBlock = runs.length === 0
    ? 'No runs stored yet.'
    : table(['Run', 'Language', 'File', 'Commit', 'Model', 'Prompt', 'Settings', 'Rows', 'Requests', 'Tokens in', 'Tokens out', 'Cost', 'Duration'], runRows)

  const scoreRows = numbered.map(({ file, run, label }) => {
    const scores = scored.get(file)?.scores
    const cells = scores ? [scores.presence.gains.recall, scores.presence.gains.precision, scores.presence.pains.recall, scores.presence.pains.precision].map(percent) : ['n/a', 'n/a', 'n/a', 'n/a']
    return [label, LANGUAGE[run.lang], `\`${run.commit}\``, ...cells]
  })
  const scoresBlock = runs.length === 0
    ? 'No runs stored yet.'
    : table(['Run', 'Language', 'Commit', 'Gains recall', 'Gains precision', 'Pains recall', 'Pains precision'], scoreRows)

  // A gap is seen in a dev run when that run found something of its kind on the item.
  const devRuns = numbered.filter(({ run }) => run.split === 'dev')
  const gapRows = gaps.map((gap) => {
    const lang = gap.id.startsWith('de-') ? 'de' : 'en'
    const seen = devRuns
      .filter(({ run, file }) => run.lang === lang && (predictions.get(file)?.find(prediction => prediction.id === gap.id)?.[gap.kind].length ?? 0) > 0)
      .map(({ n }) => n)
    return [gap.id, `${gap.kind === 'pains' ? 'pain' : gap.kind === 'gains' ? 'gain' : 'job'}: ${gap.found}`, seenIn(seen), gap.why]
  })
  const gapsBlock = gaps.length === 0 ? 'None listed.' : table(['Item', 'Found', 'Seen in (dev runs)', 'Why it may be a gap'], gapRows)

  return { runs: runsBlock, scores: scoresBlock, gaps: gapsBlock }
}

/** The log with each generated block replaced between its markers. */
export function withRunsLogBlocks(doc: string, blocks: Record<Block, string>): string {
  let out = doc
  for (const block of BLOCKS) {
    const start = `<!-- generated:${block}:start -->`
    const end = `<!-- generated:${block}:end -->`
    const from = out.indexOf(start)
    const to = out.indexOf(end)
    if (from === -1 || to < from) throw new Error(`${RUNS_LOG_PATH} needs ${start} and ${end}`)
    out = `${out.slice(0, from + start.length)}\n${blocks[block]}\n${out.slice(to)}`
  }
  return out
}
