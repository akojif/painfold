// Runs the tagging (#126): batches, two at a time, with retries, pausing on
// problems the person must fix, and resuming without sending a text twice.
// Plain code with the sending passed in, so every path is unit-tested without
// a provider; the app passes requests through sendAiRequest.
import type { AnalysisPayload, PayloadText } from './payload.ts'
import type { AiProblem } from './providers.ts'
import { answerText, batchesOf, checkAnswer, usageOf, type TaggedText } from './tagging.ts'

/** What sending one batch returned: the answer's body, or a problem with an optional wait from the provider. */
export type BatchReply = { ok: true, body: string } | { ok: false, problem: AiProblem, retryAfter?: number }

export type RunOptions = {
  payload: AnalysisPayload
  send: (batch: readonly PayloadText[]) => Promise<BatchReply>
  /** Texts already tagged in an earlier run: never sent again. */
  done?: ReadonlyMap<string, TaggedText>
  /**
   * Cancel: no new batch starts and waits end at once, but the requests
   * already in flight finish and their answers are kept, so a resumed run
   * never sends a text twice and nothing already paid for is lost.
   */
  signal: AbortSignal
  onProgress?: (tagged: number, total: number) => void
  wait?: (seconds: number, signal: AbortSignal) => Promise<void>
  concurrency?: number
}

export type RunResult = {
  tagged: Map<string, TaggedText>
  /** Texts the AI could not tag after its retries: counted as "not analysed". */
  failed: Set<string>
  droppedQuotes: number
  droppedLabels: number
  usage: { input: number, output: number }
  /** Set when the run stopped for a problem the person must fix (a key, a limit, the network) or was cancelled. */
  stopped?: AiProblem | 'cancelled'
}

// Problems no retry fixes: the run pauses and says why.
const PAUSE: ReadonlySet<AiProblem> = new Set(['invalidKey', 'browserBlocked', 'noAccess', 'modelMissing'])
// Waits between retries when the provider is busy and gives no time: 2, 4, 8, 16 seconds.
export const BACKOFF = [2, 4, 8, 16]

const defaultWait = (seconds: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, seconds * 1000)
  signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
})

export async function runTagging(options: RunOptions): Promise<RunResult> {
  const { payload, send, signal, onProgress, wait = defaultWait, concurrency = 2 } = options
  const result: RunResult = { tagged: new Map(options.done ?? []), failed: new Set(), droppedQuotes: 0, droppedLabels: 0, usage: { input: 0, output: 0 } }
  const total = payload.texts.length
  const queue = batchesOf(payload.texts.filter(text => !result.tagged.has(text.id)))
  const report = () => onProgress?.(result.tagged.size + result.failed.size, total)
  report()

  async function handle(batch: PayloadText[]): Promise<void> {
    let invalidRetries = 1
    for (let attempt = 0; ; attempt++) {
      if (signal.aborted || result.stopped) return
      const reply = await send(batch)
      if (!reply.ok) {
        if (signal.aborted) return
        if (PAUSE.has(reply.problem)) {
          result.stopped ??= reply.problem
          return
        }
        // Busy, rate-limited or unreachable: wait as asked, or back off, then try again.
        if (attempt < BACKOFF.length) {
          await wait(reply.retryAfter ?? BACKOFF[attempt]!, signal)
          continue
        }
        result.stopped ??= reply.problem
        return
      }
      const usage = usageOf(payload.provider, reply.body)
      if (usage) {
        result.usage.input += usage.input
        result.usage.output += usage.output
      }
      const text = answerText(payload.provider, reply.body)
      // Too long for one answer: split the batch and send both halves.
      if (text === 'cutOff' && batch.length > 1) {
        const half = Math.ceil(batch.length / 2)
        queue.unshift(batch.slice(0, half), batch.slice(half))
        return
      }
      const checked = typeof text === 'string' && text !== 'cutOff' && text !== 'refused' && text !== 'invalid' ? checkAnswer(batch, text) : undefined
      if (!checked && invalidRetries-- > 0) continue
      if (!checked) {
        for (const { id } of batch) result.failed.add(id)
        report()
        return
      }
      for (const tagged of checked.tagged) result.tagged.set(tagged.id, tagged)
      result.droppedQuotes += checked.droppedQuotes
      result.droppedLabels += checked.droppedLabels
      // Texts the answer left out get one more try on their own batch.
      if (checked.missing.length > 0 && invalidRetries-- > 0) {
        batch = batch.filter(entry => checked.missing.includes(entry.id))
        continue
      }
      for (const id of checked.missing) result.failed.add(id)
      report()
      return
    }
  }

  async function worker() {
    while (!signal.aborted && !result.stopped) {
      const batch = queue.shift()
      if (!batch) return
      await handle(batch)
    }
  }
  // Split batches go back into the queue, so run until it is empty.
  while (queue.length > 0 && !signal.aborted && !result.stopped) await Promise.all(Array.from({ length: concurrency }, worker))
  if (signal.aborted) result.stopped = 'cancelled'
  report()
  return result
}
