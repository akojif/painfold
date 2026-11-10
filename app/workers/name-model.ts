// The name model inside the detection worker. transformers.js is imported only
// when names are first requested, so the worker stays small for the rules.
// Everything is loaded from this site: the model from /models/ (deploy/model.ts)
// and the ONNX Runtime WebAssembly files from ortPath; remote models are off.
import type { ModelToken } from '../../core/detect/names'
import type { NameModel } from '../../core/detect/worker-protocol'
import { NAME_MODEL } from '../../deploy/model'

type TokenClassifier = (text: string, options: { ignore_labels: string[] }) => Promise<unknown>
type ProgressInfo = { status: string, file?: string, loaded?: number, total?: number }

// Threads need cross-origin isolation (deploy/headers.ts); without it, one thread.
const THREADS = 4

let classifier: Promise<TokenClassifier> | undefined

export function nameModel(ortPath: string): NameModel {
  return {
    async load(onProgress) {
      classifier ??= (async () => {
        const { env, pipeline } = await import('@huggingface/transformers')
        env.allowRemoteModels = false
        env.allowLocalModels = true
        env.localModelPath = '/models/'
        env.backends.onnx.wasm!.wasmPaths = ortPath
        env.backends.onnx.wasm!.numThreads = self.crossOriginIsolated ? Math.min(THREADS, navigator.hardwareConcurrency || 1) : 1

        // transformers.js reports progress per file; the bar shows all files together.
        const files = new Map<string, { loaded: number, total: number }>()
        const progress = (info: ProgressInfo) => {
          if (info.status !== 'progress' || !info.file) return
          files.set(info.file, { loaded: info.loaded ?? 0, total: info.total ?? 0 })
          const all = [...files.values()]
          onProgress(all.reduce((sum, file) => sum + file.loaded, 0), all.reduce((sum, file) => sum + file.total, 0))
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
