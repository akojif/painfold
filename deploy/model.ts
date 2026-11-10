// The name model Painfold serves from its own origin (see scripts/fetch-model.ts).
// The build downloads exactly this revision, checks every file against its
// SHA-256 and serves it under a versioned path, so cached copies never go stale
// and a changed or tampered file fails the build instead of reaching users.

export const NAME_MODEL = {
  /** Folder name under /models/, with the revision as the version. */
  id: 'distilbert-multilingual-ner',
  /** The ONNX export on Hugging Face (int8 quantised), and its exact revision. */
  source: 'Xenova/distilbert-base-multilingual-cased-ner-hrl',
  revision: 'c2a4dbf593c57f47004c5bc2d3770d311aee9c43',
  /** The original model and its license, shown with the accuracy numbers. */
  original: 'Davlan/distilbert-base-multilingual-cased-ner-hrl',
  license: 'AFL-3.0',
  dtype: 'int8',
  // Each file's SHA-256 and size. The size is shown to users before they agree
  // to the download, so it is checked too (scripts/fetch-model.ts). These are
  // exactly the files transformers.js loads; the repository has more.
  files: {
    'config.json': { sha256: '38847be4dc6699b1218a749ed69f888c2ccc7b4deba98e3c4a1cac8cb34d54c8', bytes: 927 },
    'tokenizer.json': { sha256: 'bf1b59b7b11c95f194f51708d918eea378e09d05f84c0e1656dc5180e8117088', bytes: 2_919_362 },
    'tokenizer_config.json': { sha256: '2d61ce6c7646881e0e7ef08e3b5dd655a19553ab85c41b1a3c27090a63ff6f49', bytes: 373 },
    'onnx/model_int8.onnx': { sha256: '92977e4b2335a2ee2fb95225e32fd0743a608091856b245c27d9001772023b06', bytes: 135_115_720 },
  } as Record<string, { sha256: string, bytes: number }>,
} as const

/** Where the model is served from: /models/<id>/<revision>/. */
export const MODEL_PATH = `/models/${NAME_MODEL.id}/${NAME_MODEL.revision}/`

/** The model files' total size in bytes. */
export const MODEL_BYTES = Object.values(NAME_MODEL.files).reduce((sum, file) => sum + file.bytes, 0)

/**
 * The browser cache (Cache Storage) that keeps the downloaded model files and
 * the runtime's WebAssembly file, and nothing else, so removing the model
 * deletes exactly this cache.
 */
export const MODEL_CACHE = 'painfold-name-model'

/**
 * The ONNX Runtime WebAssembly files, served from /ort/<version>/ instead of a CDN.
 * Only the plain WebAssembly build: the app aliases onnxruntime-web/webgpu to
 * onnxruntime-web/wasm (nuxt.config.ts), which keeps the runtime at 14 MB
 * instead of up to 28 MB; Painfold runs the model on the CPU, with threads.
 */
export const ORT_PREFIX = '/ort/'
/** The runtime itself (14 MB), kept with the model files in MODEL_CACHE. */
export const ORT_WASM = 'ort-wasm-simd-threaded.wasm'
/** The script that loads it (24 kB), which the browser imports by its address and keeps in its HTTP cache. */
export const ORT_LOADER = 'ort-wasm-simd-threaded.mjs'
export const ORT_FILES = [ORT_LOADER, ORT_WASM] as const
