// Stored runs of the analysis evaluation (#129). A run sends one split of the
// evaluation items, in one language, through the live code (tagging, then
// merging with theme names in the language of the texts), and keeps the
// provider's answers (core/ai/stored-run.ts). Replaying a run needs no key
// and no request, so the published numbers can be recomputed anywhere.
import { KINDS, MERGE_SCHEMA, runMerge } from '../core/ai/merge.ts'
import { BATCH_SIZE, buildPayload, type AnalysisPayload, type ThemeLanguage } from '../core/ai/payload.ts'
import { runTagging, type BatchReply } from '../core/ai/run.ts'
import { recorder, replayRun, type Exchange } from '../core/ai/stored-run.ts'
import { batchContent, EFFORT, MAX_TOKENS } from '../core/ai/tagging.ts'
import { countThemes, type Theme } from '../core/ai/themes.ts'
import { predictionsOf, quoteRate, type ItemPrediction, type Rate } from './analysis-metrics.ts'
import type { LabelItem } from './labels.ts'

export const EVAL_RUN_FORMAT = 'painfold-eval-run/1'
export const RUNS_DIR = 'data/eval/analysis/runs'

export type EvalRun = {
  format: typeof EVAL_RUN_FORMAT
  /** When the run was made, as an ISO date. */
  createdAt: string
  painfoldVersion: string
  commit: string
  provider: AnalysisPayload['provider']
  model: string
  settings: { batchSize: number, effort: string, maxTokens: number }
  split: LabelItem['split']
  lang: LabelItem['lang']
  /** Exactly what was sent. */
  payload: AnalysisPayload
  /** Which evaluation item each short id stands for. */
  itemOf: Array<[string, string]>
  tagging: Exchange[]
  merge: Exchange[]
  /** Tokens the provider reported, tagging and merging together. */
  usage: { input: number, output: number }
}

/** A file name that sorts by split, language, model and time: dev-en-claude-haiku-5-5-2026-11-15T10-00-00Z.json. */
export const runFileName = (run: Pick<EvalRun, 'split' | 'lang' | 'model' | 'createdAt'>) =>
  `${run.split}-${run.lang}-${run.model}-${run.createdAt.replace(/\.\d+Z$/, 'Z').replaceAll(':', '-')}.json`

export type Senders = {
  /** Sends one tagging batch (the payload's instructions, this batch). */
  tag: (payload: AnalysisPayload, batch: Parameters<typeof batchContent>[0]) => Promise<BatchReply>
  /** Sends one merge request (these instructions, these labels, the merge schema). */
  merge: (system: string, asked: string, schema: typeof MERGE_SCHEMA) => Promise<BatchReply>
}

/**
 * Runs one split in one language through the live code and keeps the answers.
 * Stops with an error if any text is not analyzed or merging stops: a partial
 * run would make the numbers look better or worse than they are.
 */
export async function recordRun(options: {
  items: readonly LabelItem[]
  split: LabelItem['split']
  lang: ThemeLanguage
  model: string
  send: Senders
  meta: Pick<EvalRun, 'createdAt' | 'painfoldVersion' | 'commit'>
  onProgress?: (done: number, total: number) => void
}): Promise<EvalRun> {
  const { items, split, lang, model, send, meta } = options
  const chosen = items.filter(item => item.split === split && item.lang === lang)
  const { payload, itemOf } = buildPayload(chosen.map(item => ({ item: item.id, text: item.text })), 'anthropic', model, lang)
  const tagging = recorder()
  const merging = recorder()
  const usage = { input: 0, output: 0 }
  const counted = async (reply: Promise<BatchReply>) => {
    const got = await reply
    if (got.ok) {
      const answer = JSON.parse(got.body) as { usage?: { input_tokens?: number, output_tokens?: number } }
      usage.input += answer.usage?.input_tokens ?? 0
      usage.output += answer.usage?.output_tokens ?? 0
    }
    return got
  }
  const signal = new AbortController().signal
  const result = await runTagging({
    payload,
    signal,
    onProgress: options.onProgress,
    send: batch => tagging.record(batchContent(batch), counted(send.tag(payload, batch))),
  })
  if (result.stopped || result.failed.size > 0) throw new Error(`Tagging did not finish (${result.stopped ?? `${result.failed.size} texts not analyzed`}); nothing was written.`)
  const merged = await runMerge({
    tagged: result.tagged,
    provider: 'anthropic',
    signal,
    send: asked => merging.record(asked, counted(send.merge(payload.mergeInstructions, asked, MERGE_SCHEMA))),
  })
  if (merged.stopped) throw new Error(`Merging stopped (${merged.stopped}); nothing was written.`)
  return {
    format: EVAL_RUN_FORMAT,
    ...meta,
    provider: 'anthropic',
    model,
    settings: { batchSize: BATCH_SIZE, effort: EFFORT, maxTokens: MAX_TOKENS },
    split,
    lang,
    payload,
    itemOf: [...itemOf],
    tagging: tagging.exchanges(),
    merge: merging.exchanges(),
    usage,
  }
}

export type ReplayedRun = {
  predictions: ItemPrediction[]
  /** Texts the replay could not analyze: should be none; any means the stored run no longer fits the code. */
  notAnalyzed: number
  /** Whether merging finished: false also means the stored run no longer fits the code. */
  merged: boolean
  quotes: Rate
  themes: Record<(typeof KINDS)[number], number>
  /** The counted themes themselves, for the theme mapping (scripts/theme-mapping.ts). */
  counted: Record<(typeof KINDS)[number], Theme[]>
}

/** Replays a stored run through the live code and turns it into predictions by item id. */
export async function replayEvalRun(run: EvalRun): Promise<ReplayedRun> {
  const { result, merge } = await replayRun(run.payload, run.tagging, run.merge)
  const itemOf = new Map(run.itemOf)
  const themes = countThemes(result.tagged, merge.themes, itemOf)
  return {
    predictions: predictionsOf(result.tagged, themes, itemOf),
    notAnalyzed: run.payload.texts.length - result.tagged.size,
    merged: !merge.stopped,
    quotes: quoteRate(result.tagged, result.droppedQuotes),
    themes: Object.fromEntries(KINDS.map(kind => [kind, themes[kind].length])) as ReplayedRun['themes'],
    counted: themes,
  }
}
