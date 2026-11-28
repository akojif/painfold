// A stored run: the provider's answers to an analysis, kept with what was
// asked, so the run can be replayed later through the same code as a live
// run (runTagging, runMerge, the checks and the counting) without any
// request. Used by the demo (#130) and the analysis evaluation (#129).
import type { AnalysisPayload, PayloadText } from './payload.ts'
import { runMerge, type MergeResult } from './merge.ts'
import { runTagging, type BatchReply, type RunResult } from './run.ts'
import { batchContent } from './tagging.ts'

/** One request and its answer: what was asked (a batch or the labels, as sent) and the answer as stored. */
export type Exchange = { asked: string, answer: string }

/** An answer as stored: only what the checks read (the stop reason, the text, the token counts), never the model's thinking. */
export function storedAnswer(body: string): string {
  const answer = JSON.parse(body) as { stop_reason?: string, content?: Array<{ type?: string, text?: string }>, usage?: { input_tokens?: number, output_tokens?: number } }
  return JSON.stringify({
    stop_reason: answer.stop_reason,
    content: (answer.content ?? []).filter(block => block.type === 'text').map(block => ({ type: 'text', text: block.text })),
    usage: { input_tokens: answer.usage?.input_tokens ?? 0, output_tokens: answer.usage?.output_tokens ?? 0 },
  })
}

/** Records the answers a send gets, by what was asked; a retry keeps the last answer. */
export function recorder() {
  const answers = new Map<string, string>()
  return {
    record: async (asked: string, reply: Promise<BatchReply>): Promise<BatchReply> => {
      const got = await reply
      if (got.ok) answers.set(asked, storedAnswer(got.body))
      return got
    },
    exchanges: (): Exchange[] => [...answers].map(([asked, answer]) => ({ asked, answer })),
  }
}

/** Answers from the store; anything the stored run did not ask gets no answer, so a changed request shows as texts not analyzed. */
export function fromStore(entries: readonly Exchange[]) {
  const byAsked = new Map(entries.map(entry => [entry.asked, entry.answer]))
  return async (asked: string): Promise<BatchReply> => {
    const answer = byAsked.get(asked)
    return answer === undefined ? { ok: false, problem: 'unreachable' } : { ok: true, body: answer }
  }
}

/** Replays stored answers through the live tagging and merging. */
export async function replayRun(payload: AnalysisPayload, tagging: readonly Exchange[], merge: readonly Exchange[]): Promise<{ result: RunResult, merge: MergeResult }> {
  const signal = new AbortController().signal
  const noWait = async () => {}
  const tag = fromStore(tagging)
  const result = await runTagging({ payload, signal, wait: noWait, send: (batch: readonly PayloadText[]) => tag(batchContent(batch)) })
  const merged = await runMerge({ tagged: result.tagged, provider: payload.provider, signal, wait: noWait, send: fromStore(merge) })
  return { result, merge: merged }
}
