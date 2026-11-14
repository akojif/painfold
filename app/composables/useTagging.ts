import type { AnalysisPayload } from '~~/core/ai/payload'
import { ANTHROPIC, OLLAMA, type AiRequest } from '~~/core/ai/providers'
import { runTagging, type BatchReply, type RunResult } from '~~/core/ai/run'
import { anthropicJsonRequest, anthropicTaggingRequest, ollamaJsonRequest, ollamaTaggingRequest, type TaggedText } from '~~/core/ai/tagging'
import { MERGE_SCHEMA, runMerge, type MergeResult } from '~~/core/ai/merge'
import { countThemes } from '~~/core/ai/themes'

// The analysis run (Stage 3, slices 4 and 5, #126, #127): sends the consent
// step's payload in batches, then merges the labels found into themes, and
// keeps the results for this visit, in memory. The themes are counted in code
// (core/ai/themes.ts); the report (slice 6) reads them here.
export type TaggingState = 'idle' | 'running' | 'merging' | 'stopping' | 'stopped' | 'done'

const state = ref<TaggingState>('idle')
const progress = ref({ done: 0, total: 0 })
const result = shallowRef<RunResult>()
const merge = shallowRef<MergeResult>()
// Which item each short id stands for, from the payload that was sent.
const itemOf = shallowRef<ReadonlyMap<string, string>>(new Map())
// Every count is made here, in code, from the tags and the merged themes.
const themes = computed(() => (result.value && merge.value && !merge.value.stopped ? countThemes(result.value.tagged, merge.value.themes, itemOf.value) : undefined))
let controller: AbortController | undefined
let sentPayload: AnalysisPayload | undefined

export function useTagging() {
  const { key } = useAiSettings()

  async function run(payload: AnalysisPayload, items: ReadonlyMap<string, string>, done?: ReadonlyMap<string, TaggedText>) {
    controller = new AbortController()
    sentPayload = payload
    itemOf.value = items
    state.value = 'running'
    const outcome = await runTagging({
      payload,
      done,
      signal: controller.signal,
      onProgress: (tagged, total) => (progress.value = { done: tagged, total }),
      send: async (batch) => {
        const request = payload.provider === 'anthropic' ? anthropicTaggingRequest(key.value.trim(), payload, batch) : ollamaTaggingRequest(payload, batch)
        return reply(payload, request)
      },
    })
    result.value = outcome
    if (outcome.stopped) state.value = 'stopped'
    else await mergeThemes(payload)
  }

  /** Merges the labels found into themes; only labels are sent. */
  async function mergeThemes(payload: AnalysisPayload) {
    if (!result.value) return
    controller = new AbortController()
    state.value = 'merging'
    const outcome = await runMerge({
      tagged: result.value.tagged,
      provider: payload.provider,
      done: merge.value?.themes,
      signal: controller.signal,
      send: async (content) => {
        const request = payload.provider === 'anthropic'
          ? anthropicJsonRequest(key.value.trim(), payload.model, payload.mergeInstructions, content, MERGE_SCHEMA)
          : ollamaJsonRequest(payload.model, payload.mergeInstructions, content, MERGE_SCHEMA)
        return reply(payload, request)
      },
    })
    merge.value = outcome
    state.value = outcome.stopped ? 'stopped' : 'done'
  }

  async function reply(payload: AnalysisPayload, request: AiRequest): Promise<BatchReply> {
    const answer = await sendAiRequest(payload.provider === 'anthropic' ? ANTHROPIC : OLLAMA, request)
    return answer.ok ? { ok: true, body: answer.body } : { ok: false, problem: answer.problem, retryAfter: answer.retryAfter }
  }

  /** Sends the payload, as the consent step showed it. */
  function start(payload: AnalysisPayload, items: ReadonlyMap<string, string>) {
    result.value = undefined
    merge.value = undefined
    progress.value = { done: 0, total: payload.texts.length }
    return run(payload, items)
  }

  /** Sends only the texts not tagged yet. */
  function resume() {
    if (!sentPayload || !result.value) return
    if (result.value.stopped) return run(sentPayload, itemOf.value, result.value.tagged)
    return mergeThemes(sentPayload)
  }

  /** No new batch starts; the requests in flight finish and their answers are kept. */
  function cancel() {
    if (state.value !== 'running' && state.value !== 'merging') return
    state.value = 'stopping'
    controller?.abort()
  }

  /** Forgets the run, for a new file or a changed review. */
  function reset() {
    controller?.abort()
    state.value = 'idle'
    result.value = undefined
    merge.value = undefined
    progress.value = { done: 0, total: 0 }
  }

  return { state: readonly(state), progress: readonly(progress), result, merge, themes, itemOf, start, resume, cancel, reset }
}
