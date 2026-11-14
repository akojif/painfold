import type { AnalysisPayload } from '~~/core/ai/payload'
import { ANTHROPIC, OLLAMA } from '~~/core/ai/providers'
import { runTagging, type RunResult } from '~~/core/ai/run'
import { anthropicTaggingRequest, ollamaTaggingRequest, type TaggedText } from '~~/core/ai/tagging'

// The analysis run (Stage 3, slice 4, #126): sends the consent step's payload
// in batches and keeps the checked answers for this visit, in memory, keyed by
// item. Merging into themes and the report (slices 5 and 6) read them here.
export type TaggingState = 'idle' | 'running' | 'stopping' | 'stopped' | 'done'

const state = ref<TaggingState>('idle')
const progress = ref({ done: 0, total: 0 })
const result = shallowRef<RunResult>()
// Which item each short id stands for, from the payload that was sent.
const itemOf = shallowRef<ReadonlyMap<string, string>>(new Map())
let controller: AbortController | undefined
let sentPayload: AnalysisPayload | undefined

export function useTagging() {
  const { key } = useAiSettings()

  async function run(payload: AnalysisPayload, items: ReadonlyMap<string, string>, done?: ReadonlyMap<string, TaggedText>) {
    controller = new AbortController()
    sentPayload = payload
    itemOf.value = items
    state.value = 'running'
    const provider = payload.provider === 'anthropic' ? ANTHROPIC : OLLAMA
    const outcome = await runTagging({
      payload,
      done,
      signal: controller.signal,
      onProgress: (tagged, total) => (progress.value = { done: tagged, total }),
      send: async (batch) => {
        const request = payload.provider === 'anthropic' ? anthropicTaggingRequest(key.value.trim(), payload, batch) : ollamaTaggingRequest(payload, batch)
        const answer = await sendAiRequest(provider, request)
        return answer.ok ? { ok: true, body: answer.body } : { ok: false, problem: answer.problem, retryAfter: answer.retryAfter }
      },
    })
    result.value = outcome
    state.value = outcome.stopped ? 'stopped' : 'done'
  }

  /** Sends the payload, as the consent step showed it. */
  function start(payload: AnalysisPayload, items: ReadonlyMap<string, string>) {
    result.value = undefined
    progress.value = { done: 0, total: payload.texts.length }
    return run(payload, items)
  }

  /** Sends only the texts not tagged yet. */
  function resume() {
    if (!sentPayload || !result.value) return
    return run(sentPayload, itemOf.value, result.value.tagged)
  }

  /** No new batch starts; the requests in flight finish and their answers are kept. */
  function cancel() {
    if (state.value !== 'running') return
    state.value = 'stopping'
    controller?.abort()
  }

  /** Forgets the run, for a new file or a changed review. */
  function reset() {
    controller?.abort()
    state.value = 'idle'
    result.value = undefined
    progress.value = { done: 0, total: 0 }
  }

  return { state: readonly(state), progress: readonly(progress), result, itemOf, start, resume, cancel, reset }
}
