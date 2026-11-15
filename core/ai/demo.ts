// Demo mode (Stage 3, slice 8, #130): a real analysis of the made-up sample
// file, stored in Painfold, so anyone can see the report without an API key.
// What is stored are the provider's answers, not finished results: showing
// the demo replays them through the same code as a live run (runTagging,
// runMerge, the checks and the counting), with a send that answers from the
// store instead of calling anyone. Nothing leaves the browser.
// `npm run demo:generate` makes the file (scripts/demo-generate.ts).
import { mergeInstructions, type AnalysisPayload, type PayloadText, type ThemeLanguage } from './payload.ts'
import { runMerge, type MergeResult } from './merge.ts'
import { runTagging, type BatchReply, type RunResult } from './run.ts'
import { batchContent } from './tagging.ts'

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
  tagging: Array<{ asked: string, answer: string }>
  /** The merge answers per theme language, by what was asked (the labels as sent). */
  merge: Record<ThemeLanguage, Array<{ asked: string, answer: string }>>
}

/** An answer as stored: only what the checks read (the stop reason, the text, the token counts), never the model's thinking. */
export function storedAnswer(body: string): string {
  const answer = JSON.parse(body) as { stop_reason?: string, content?: Array<{ type?: string, text?: string }>, usage?: { input_tokens?: number, output_tokens?: number } }
  return JSON.stringify({
    stop_reason: answer.stop_reason,
    content: (answer.content ?? []).filter(block => block.type === 'text').map(block => ({ type: 'text', text: block.text })),
    usage: { input_tokens: answer.usage?.input_tokens ?? 0, output_tokens: answer.usage?.output_tokens ?? 0 },
  })
}

/** Answers from the store; anything not asked in the stored run gets no answer, so a changed request shows as texts not analyzed. */
function fromStore(entries: ReadonlyArray<{ asked: string, answer: string }>) {
  const byAsked = new Map(entries.map(entry => [entry.asked, entry.answer]))
  return async (asked: string): Promise<BatchReply> => {
    const answer = byAsked.get(asked)
    return answer === undefined ? { ok: false, problem: 'unreachable' } : { ok: true, body: answer }
  }
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
  const signal = new AbortController().signal
  const noWait = async () => {}
  const tagging = fromStore(demo.tagging)
  const result = await runTagging({ payload, signal, wait: noWait, send: (batch: readonly PayloadText[]) => tagging(batchContent(batch)) })
  const merge = await runMerge({ tagged: result.tagged, provider: payload.provider, signal, wait: noWait, send: fromStore(demo.merge[language]) })
  return { payload, itemOf: new Map(demo.itemOf), result, merge }
}
