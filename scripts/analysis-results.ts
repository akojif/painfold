// The analysis evaluation's results (#129): every stored run, replayed and
// compared with the gold labels for its language and split. Plain data, so
// the numbers can be written to data/eval/analysis/results.json, checked by a
// unit test, and shown on the Accuracy page. No dates of the computation are
// written, so the same runs and labels always give the same file.
import type { Kind } from '../core/ai/merge.ts'
import { accuracy, grouping, presence, stability, tags, type Accuracy, type Rate, type Scores } from './analysis-metrics.ts'
import { replayEvalRun, type EvalRun } from './analysis-runs.ts'
import type { FeedbackType, ItemLabels, Sentiment } from './labels.ts'
import type { StoredMapping } from './theme-mapping.ts'

export const RESULTS_FORMAT = 'painfold-analysis-results/1'
export const RESULTS_PATH = 'data/eval/analysis/results.json'

export type RunResults = {
  file: string
  split: EvalRun['split']
  lang: EvalRun['lang']
  model: string
  createdAt: string
  commit: string
  texts: number
  /** Should be 0 and true; anything else means the stored run no longer fits the code. */
  notAnalyzed: number
  merged: boolean
  themes: Record<Kind, number>
  quotes: Rate
  /** Undefined until the labels for this language exist. */
  scores?: {
    items: number
    presence: Record<Kind, Scores>
    grouping: Record<Kind, Scores>
    sentiment: Accuracy<Sentiment>
    type: Accuracy<FeedbackType>
    /** Tag-level, only once a person has mapped this run's themes (the final test run). */
    tags?: Record<Kind, Scores>
    mappedBy?: string
  }
}

export type StabilityResults = {
  split: EvalRun['split']
  lang: EvalRun['lang']
  model: string
  files: [string, string]
  presence: Rate
  grouping: Record<Kind, Scores>
}

export type AnalysisResults = {
  format: typeof RESULTS_FORMAT
  runs: RunResults[]
  stability: StabilityResults[]
}

/** Scores every run, in file-name order; stability compares the first two runs of each split, language and model. */
export async function computeResults(runs: ReadonlyArray<{ file: string, run: EvalRun }>, labels: readonly ItemLabels[], mappings: readonly StoredMapping[] = []): Promise<AnalysisResults> {
  const sorted = [...runs].sort((a, b) => a.file.localeCompare(b.file))
  const results: RunResults[] = []
  const predictions = new Map<string, Awaited<ReturnType<typeof replayEvalRun>>>()
  for (const { file, run } of sorted) {
    const replayed = await replayEvalRun(run)
    predictions.set(file, replayed)
    const gold = labels.filter(label => label.lang === run.lang && label.split === run.split)
    const mapped = mappings.find(mapping => mapping.run === file)
    results.push({
      file,
      split: run.split,
      lang: run.lang,
      model: run.model,
      createdAt: run.createdAt,
      commit: run.commit,
      texts: run.payload.texts.length,
      notAnalyzed: replayed.notAnalyzed,
      merged: replayed.merged,
      themes: replayed.themes,
      quotes: replayed.quotes,
      ...(gold.length > 0
        ? {
            scores: {
              items: gold.length,
              presence: presence(gold, replayed.predictions),
              grouping: grouping(gold, replayed.predictions),
              sentiment: accuracy(gold, replayed.predictions, 'sentiment'),
              type: accuracy(gold, replayed.predictions, 'type'),
              ...(mapped ? { tags: tags(gold, replayed.predictions, mapped.mapping), mappedBy: mapped.mappedBy } : {}),
            },
          }
        : {}),
    })
  }

  const stabilityResults: StabilityResults[] = []
  const groups = new Map<string, string[]>()
  for (const { file, run } of sorted) {
    const key = `${run.split}|${run.lang}|${run.model}`
    groups.set(key, [...(groups.get(key) ?? []), file])
  }
  for (const [key, files] of groups) {
    if (files.length < 2) continue
    const [split, lang, model] = key.split('|') as [EvalRun['split'], EvalRun['lang'], string]
    const [first, second] = files as [string, string]
    const compared = stability(predictions.get(first)!.predictions, predictions.get(second)!.predictions)
    stabilityResults.push({ split, lang, model, files: [first, second], ...compared })
  }
  return { format: RESULTS_FORMAT, runs: results, stability: stabilityResults }
}

/** The file as written: two-space JSON with a final line break. */
export const resultsJson = (results: AnalysisResults) => `${JSON.stringify(results, null, 2)}\n`
