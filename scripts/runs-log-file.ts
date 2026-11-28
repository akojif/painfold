// Rewrites the generated tables of data/eval/analysis/runs-log.md from the
// stored runs (scripts/runs-log.ts). Used by `npm run eval:analysis -- --write`
// and by the unit test that checks the committed log.
import { existsSync, readFileSync } from 'node:fs'
import type { AnalysisResults } from './analysis-results.ts'
import { replayEvalRun, type EvalRun } from './analysis-runs.ts'
import { LABEL_GAPS_PATH, runsLogBlocks, withRunsLogBlocks, type LabelGap } from './runs-log.ts'

export async function runsLog(doc: string, runs: ReadonlyArray<{ file: string, run: EvalRun }>, results: AnalysisResults): Promise<string> {
  const gaps = existsSync(LABEL_GAPS_PATH) ? JSON.parse(readFileSync(LABEL_GAPS_PATH, 'utf8')) as LabelGap[] : []
  const predictions = new Map<string, Awaited<ReturnType<typeof replayEvalRun>>['predictions']>()
  for (const { file, run } of runs) predictions.set(file, (await replayEvalRun(run)).predictions)
  return withRunsLogBlocks(doc, runsLogBlocks(runs, results, predictions, gaps))
}
