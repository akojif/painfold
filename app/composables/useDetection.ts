import type { ItemCounts, ItemDetections, TextItem } from '../../core/detect/items'
import type { DetectRequest, DetectResponse } from '../../core/detect/worker-protocol'

/**
 * Runs detection in a Web Worker so the page stays responsive on large files.
 * The worker is started on first use and stopped with the component that uses it.
 */
export function useDetection() {
  const progress = ref<{ done: number, total: number }>()
  let worker: Worker | undefined
  let lastId = 0

  function request(kind: DetectRequest['kind'], items: TextItem[]): Promise<DetectResponse> {
    worker ??= new Worker(new URL('../workers/detect.worker.ts', import.meta.url), { type: 'module' })
    const active = worker
    const id = ++lastId

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }: MessageEvent<DetectResponse>) => {
        if (data.id !== id) return
        if (data.kind === 'progress') {
          // Only runs for review show progress; a survey runs quietly.
          if (kind !== 'survey') progress.value = { done: data.done, total: data.total }
          return
        }
        active.removeEventListener('message', onMessage)
        if (data.kind === 'error') reject(new Error(data.message))
        else resolve(data)
      }
      active.addEventListener('message', onMessage)
      active.postMessage({ kind, id, items } satisfies DetectRequest)
    })
  }

  /** Every finding in the items, for review. Progress counts units (rows). */
  async function run(items: TextItem[]): Promise<ItemDetections[]> {
    progress.value = { done: 0, total: new Set(items.map(item => item.unit ?? item.id)).size }
    const response = await request('detect', items)
    return response.kind === 'result' ? response.items : []
  }

  /** How much personal data each item holds, as counts per type; the column step adds them up per column. */
  async function survey(items: TextItem[]): Promise<ItemCounts[]> {
    const response = await request('survey', items)
    return response.kind === 'survey' ? response.counts : []
  }

  onScopeDispose(() => worker?.terminate())

  return { run, survey, progress: readonly(progress) }
}
