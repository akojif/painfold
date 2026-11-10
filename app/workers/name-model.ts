// The name model inside the names worker. transformers.js is imported only
// when the model is first loaded, so nothing is downloaded before the user
// agrees. Everything is loaded from this site: the model from /models/
// (deploy/model.ts) and the ONNX Runtime WebAssembly files from ortPath;
// remote models are off.
//
// Everything downloaded is kept in one Cache Storage cache (MODEL_CACHE): the
// model files, stored there by transformers.js, and the runtime's WebAssembly
// file, stored here and handed to ONNX Runtime as bytes, so it is downloaded
// once and works offline. A later visit opens both without downloading, and
// removing the model deletes exactly that cache. Only the runtime's 24 kB
// loader script is imported by its address and kept in the HTTP cache.
import type { ModelToken } from '../../core/detect/names'
import type { NameModel } from '../../core/detect/worker-protocol'
import { MODEL_CACHE, NAME_MODEL, ORT_WASM } from '../../deploy/model'

type TokenClassifier = (text: string, options: { ignore_labels: string[] }) => Promise<unknown>
type ProgressInfo = { status: string, file?: string, loaded?: number }

// Threads need cross-origin isolation (deploy/headers.ts); without it, one thread.
const THREADS = 4

let classifier: Promise<TokenClassifier> | undefined

/** Reads a response to the end, reporting the bytes read so far. */
async function readAll(response: Response, onProgress: (loaded: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = []
  let loaded = 0
  const reader = response.body!.getReader()
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    chunks.push(chunk.value)
    loaded += chunk.value.byteLength
    onProgress(loaded)
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** The runtime's WebAssembly file, from the model's cache or downloaded and stored there. */
async function runtimeBinary(url: string, onProgress: (loaded: number) => void): Promise<ArrayBuffer> {
  const cache = await caches.open(MODEL_CACHE).catch(() => undefined)
  const cached = await cache?.match(url)
  if (cached) return await cached.arrayBuffer()
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Loading ${url} failed: ${response.status}`)
  const bytes = await readAll(response, onProgress)
  // A full cache is not an error: the runtime still works for this visit.
  await cache?.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/wasm' } })).catch(() => undefined)
  return bytes.buffer
}

export function nameModel(ortPath: string): NameModel {
  return {
    async load(onProgress) {
      classifier ??= (async () => {
        // One count for everything downloaded: the runtime first, then the model files.
        const loaded = new Map<string, number>()
        const update = (file: string, bytes: number) => {
          loaded.set(file, bytes)
          onProgress([...loaded.values()].reduce((sum, value) => sum + value, 0))
        }

        const wasmBinary = await runtimeBinary(new URL(`${ortPath}${ORT_WASM}`, location.href).href, bytes => update(ORT_WASM, bytes))

        const { env, pipeline } = await import('@huggingface/transformers')
        env.allowRemoteModels = false
        env.allowLocalModels = true
        env.localModelPath = '/models/'
        env.cacheKey = MODEL_CACHE
        env.backends.onnx.wasm!.wasmPaths = ortPath
        env.backends.onnx.wasm!.wasmBinary = wasmBinary
        env.backends.onnx.wasm!.numThreads = self.crossOriginIsolated ? Math.min(THREADS, navigator.hardwareConcurrency || 1) : 1

        const progress = (info: ProgressInfo) => {
          if (info.status === 'progress' && info.file) update(info.file, info.loaded ?? 0)
        }
        return await pipeline('token-classification', `${NAME_MODEL.id}/${NAME_MODEL.revision}`, {
          dtype: NAME_MODEL.dtype,
          device: 'wasm',
          progress_callback: progress as never,
        }) as unknown as TokenClassifier
      })()
      try {
        await classifier
      }
      catch (error) {
        classifier = undefined
        throw error
      }
    },
    async label(text) {
      const classify = await classifier!
      return await classify(text, { ignore_labels: ['O'] }) as ModelToken[]
    },
  }
}
