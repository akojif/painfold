import type { CellDetections, ColumnCounts } from '../../core/detect/table'
import type { DetectRequest, DetectResponse } from '../../core/detect/worker-protocol'

/**
 * Runs detection in a Web Worker so the page stays responsive on large files.
 * The worker is started on first use and stopped with the component that uses it.
 */
export function useDetection() {
  const progress = ref<{ done: number, total: number }>()
  // Bytes of the name model downloaded so far, while it loads.
  const modelProgress = ref<{ loaded: number, total: number }>()
  let worker: Worker | undefined
  let lastId = 0

  function request(kind: DetectRequest['kind'], rows: string[][], columns: number[], extra: Partial<Extract<DetectRequest, { kind: 'names' }>> = {}): Promise<DetectResponse> {
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
        if (data.kind === 'model-progress') {
          modelProgress.value = { loaded: data.loaded, total: data.total }
          return
        }
        active.removeEventListener('message', onMessage)
        if (data.kind === 'error') reject(new Error(data.message))
        else resolve(data)
      }
      active.addEventListener('message', onMessage)
      active.postMessage({ kind, id, rows, columns, ...extra } as DetectRequest)
    })
  }

  /** Every finding in the given columns, for review. */
  async function run(rows: string[][], columns: number[]): Promise<CellDetections[]> {
    progress.value = { done: 0, total: rows.length }
    const response = await request('detect', rows, columns)
    return response.kind === 'result' ? response.cells : []
  }

  /** How much personal data each of the given columns holds, as counts per type. */
  async function survey(rows: string[][], columns: number[]): Promise<ColumnCounts[]> {
    const response = await request('survey', rows, columns)
    return response.kind === 'survey' ? response.columns : []
  }

  /** Names and places in the given columns, found by the name model, which the worker loads on first use. */
  async function names(rows: string[][], columns: number[]): Promise<CellDetections[]> {
    progress.value = { done: 0, total: rows.length }
    const response = await request('names', rows, columns, { ortPath: useRuntimeConfig().public.ortPath })
    return response.kind === 'result' ? response.cells : []
  }

  onScopeDispose(() => worker?.terminate())

  return { run, survey, names, progress: readonly(progress), modelProgress: readonly(modelProgress) }
}
