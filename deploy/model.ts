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
  files: {
    'config.json': '38847be4dc6699b1218a749ed69f888c2ccc7b4deba98e3c4a1cac8cb34d54c8',
    'tokenizer.json': 'bf1b59b7b11c95f194f51708d918eea378e09d05f84c0e1656dc5180e8117088',
    'tokenizer_config.json': '2d61ce6c7646881e0e7ef08e3b5dd655a19553ab85c41b1a3c27090a63ff6f49',
    'special_tokens_map.json': 'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3',
    'onnx/model_int8.onnx': '92977e4b2335a2ee2fb95225e32fd0743a608091856b245c27d9001772023b06',
  } as Record<string, string>,
} as const

/** Where the model is served from: /models/<id>/<revision>/. */
export const MODEL_PATH = `/models/${NAME_MODEL.id}/${NAME_MODEL.revision}/`

/**
 * The ONNX Runtime WebAssembly files, served from /ort/<version>/ instead of a CDN.
 * Only the plain WebAssembly build: the app aliases onnxruntime-web/webgpu to
 * onnxruntime-web/wasm (nuxt.config.ts), which keeps the runtime at 14 MB
 * instead of up to 28 MB; Painfold runs the model on the CPU, with threads.
 */
export const ORT_PREFIX = '/ort/'
export const ORT_FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'] as const
