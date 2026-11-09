import type { CellDetections } from '../../core/detect/table'
import type { DetectRequest, DetectResponse } from '../../core/detect/worker-protocol'

/**
 * Runs detection in a Web Worker so the page stays responsive on large files.
 * The worker is started on first use and stopped with the component that uses it.
 */
export function useDetection() {
  const progress = ref<{ done: number, total: number }>()
  let worker: Worker | undefined
  let lastId = 0

  function run(rows: string[][], columns: number[]): Promise<CellDetections[]> {
    worker ??= new Worker(new URL('../workers/detect.worker.ts', import.meta.url), { type: 'module' })
    const active = worker
    const id = ++lastId
    progress.value = { done: 0, total: rows.length }

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }: MessageEvent<DetectResponse>) => {
        if (data.id !== id) return
        if (data.kind === 'progress') {
          progress.value = { done: data.done, total: data.total }
          return
        }
        active.removeEventListener('message', onMessage)
        if (data.kind === 'result') resolve(data.cells)
        else reject(new Error(data.message))
      }
      active.addEventListener('message', onMessage)
      active.postMessage({ kind: 'detect', id, rows, columns } satisfies DetectRequest)
    })
  }

  onScopeDispose(() => worker?.terminate())

  return { run, progress: readonly(progress) }
}
