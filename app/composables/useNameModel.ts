import type { ItemDetections, TextItem } from '~~/core/detect/items'
import { isCostlyConnection, isModelStored, removeModel } from '~~/core/detect/model-storage'
import type { NameRequest, NameResponse } from '~~/core/detect/worker-protocol'

// unknown: not checked yet. absent: not in this browser. downloading: on its
// way. ready: downloaded (stored says whether the browser kept it for next
// time). failed: the download stopped. offline: it cannot start without a
// connection.
export type NameModelStatus = 'unknown' | 'absent' | 'downloading' | 'ready' | 'failed' | 'offline'

// One download for the whole visit, shared by the column step and the review,
// so it goes on while the user moves between them. The model runs in its own
// worker: cancelling stops that worker and nothing else.
const status = ref<NameModelStatus>('unknown')
const loaded = ref(0)
const stored = ref(true)
let worker: Worker | undefined
let lastId = 0
let checked = false
// Rejects the requests still waiting when the worker is stopped.
const pending = new Set<(error: Error) => void>()

/** What a waiting request rejects with when the model's worker is stopped. */
export class NameModelStopped extends Error {}

// A request as the page writes it; the id and the runtime path are added here.
type Message = { kind: 'load' } | { kind: 'names', items: TextItem[] }
// Cache Storage is missing in some private windows; the model then works for the visit only.
const storage = () => (globalThis.caches as CacheStorage | undefined)

function stopWorker() {
  worker?.terminate()
  worker = undefined
  for (const reject of pending) reject(new NameModelStopped('The name model was stopped'))
  pending.clear()
}

function startWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/names.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', ({ data }: MessageEvent<NameResponse>) => {
    if (data.kind === 'resources') recordWorkerRequests(data.entries)
  })
  return worker
}

function request(message: Message): Promise<NameResponse> {
  const active = startWorker()
  const id = ++lastId
  return new Promise((resolve, reject) => {
    const onMessage = ({ data }: MessageEvent<NameResponse>) => {
      if (data.kind === 'resources' || data.id !== id) return
      if (data.kind === 'model-progress') {
        loaded.value = data.loaded
        return
      }
      if (data.kind === 'progress') return
      active.removeEventListener('message', onMessage)
      pending.delete(reject)
      if (data.kind === 'error') reject(new Error(data.message))
      else resolve(data)
    }
    pending.add(reject)
    active.addEventListener('message', onMessage)
    active.postMessage({ ...message, id, ortPath: useRuntimeConfig().public.ortPath } as NameRequest)
  })
}

async function check() {
  if (checked) return
  checked = true
  if (status.value === 'unknown') status.value = (await isModelStored(storage(), location.href, useRuntimeConfig().public.ortPath)) ? 'ready' : 'absent'
  // Coming back online makes the download possible again.
  addEventListener('online', () => {
    if (status.value === 'offline') status.value = 'absent'
  })
}

/**
 * The name model: whether it is in this browser, and downloading, cancelling
 * or removing it. Nothing is downloaded until download() is called.
 */
export function useNameModel() {
  const total = useRuntimeConfig().public.downloadBytes
  // Only where the browser reports it; most browsers do not.
  const costly = ref(false)

  onMounted(() => {
    costly.value = isCostlyConnection((navigator as Navigator & { connection?: { saveData?: boolean, type?: string } }).connection)
    void check()
  })

  async function download() {
    if (status.value === 'downloading' || status.value === 'ready') return
    if (!navigator.onLine) {
      status.value = 'offline'
      return
    }
    status.value = 'downloading'
    loaded.value = 0
    try {
      await request({ kind: 'load' })
      stored.value = await isModelStored(storage(), location.href, useRuntimeConfig().public.ortPath)
      status.value = 'ready'
    }
    catch (error) {
      if (error instanceof NameModelStopped) return
      status.value = navigator.onLine ? 'failed' : 'offline'
    }
  }

  /** Stops the download and deletes what had arrived. */
  async function cancel() {
    stopWorker()
    status.value = 'absent'
    loaded.value = 0
    await removeModel(storage())
  }

  /** Deletes the model from this browser; it can be downloaded again. */
  async function remove() {
    stopWorker()
    await removeModel(storage())
    status.value = 'absent'
    stored.value = true
    loaded.value = 0
  }

  /** Names and places in the items; the model must be ready. Rejects with a NameModelStopped error after stop(). */
  async function names(items: TextItem[]): Promise<ItemDetections[]> {
    const response = await request({ kind: 'names', items })
    return response.kind === 'result' ? response.items : []
  }

  /** Stops whatever the model is doing; a stored model stays stored. */
  function stop() {
    stopWorker()
    if (status.value === 'downloading') status.value = 'absent'
  }

  return { total, stop, costly: readonly(costly), status: readonly(status), loaded: readonly(loaded), stored: readonly(stored), download, cancel, remove, names }
}
