// Demo mode (Stage 3, slice 8, #130): a real analysis of the made-up sample
// file, stored in Painfold, so anyone can see the report without an API key.
// What is stored are the provider's answers, not finished results: showing
// the demo replays them through the same code as a live run (runTagging,
// runMerge, the checks and the counting), with a send that answers from the
// store instead of calling anyone. Nothing leaves the browser.
// `npm run demo:generate` makes the file (scripts/demo-generate.ts).
import type { MergeResult } from './merge.ts'
import { mergeInstructions, type AnalysisPayload, type ThemeLanguage } from './payload.ts'
import type { RunResult } from './run.ts'
import { replayRun, type Exchange } from './stored-run.ts'

export const DEMO_FORMAT = 'painfold-demo/1'

/** Where an item of the sample is, and the values kept from its row, so the report can show them without a file open. */
export type DemoItem = { row: number, attributes: Record<string, string> }

export type DemoRun = {
  format: typeof DEMO_FORMAT
  /** When the run was made, as an ISO date. */
  createdAt: string
  painfoldVersion: string
  commit: string
  provider: AnalysisPayload['provider']
  model: string
  settings: { batchSize: number, effort: string, maxTokens: number }
  /** True for a stand-in made from invented answers while building; a real run is false. */
  standIn: boolean
  /** Exactly what was sent: the cleaned sample texts and the instructions (merge instructions in English). */
  payload: AnalysisPayload
  /** Which item each short id stands for. */
  itemOf: Array<[string, string]>
  items: Record<string, DemoItem>
  /** The tagging answers, by what was asked (the batch as sent). */
  tagging: Exchange[]
  /** The merge answers per theme language, by what was asked (the labels as sent). */
  merge: Record<ThemeLanguage, Exchange[]>
}

export type DemoAnalysis = {
  payload: AnalysisPayload
  itemOf: Map<string, string>
  result: RunResult
  merge: MergeResult
}

/** Replays the stored run through the live code, with theme names in this language. */
export async function replayDemo(demo: DemoRun, language: ThemeLanguage): Promise<DemoAnalysis> {
  const payload = { ...demo.payload, mergeInstructions: mergeInstructions(language) }
  const { result, merge } = await replayRun(payload, demo.tagging, demo.merge[language])
  return { payload, itemOf: new Map(demo.itemOf), result, merge }
}
