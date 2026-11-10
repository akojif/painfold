// Whether the name model is kept in this browser, and removing it. The model
// files and the runtime's WebAssembly file sit in their own Cache Storage
// cache (MODEL_CACHE in deploy/model.ts), keyed by the address they were
// downloaded from.
import { MODEL_CACHE, MODEL_PATH, NAME_MODEL, ORT_WASM } from '../../deploy/model.ts'

type Caches = Pick<CacheStorage, 'has' | 'open' | 'delete'>

/** The addresses of everything the cache must hold, for this build's runtime path. */
export function storedUrls(base: string, ortPath: string): string[] {
  return [...Object.keys(NAME_MODEL.files).map(file => `${MODEL_PATH}${file}`), `${ortPath}${ORT_WASM}`].map(path => new URL(path, base).href)
}

/** True only when every file is in the cache; a cache that cannot be opened counts as empty. */
export async function isModelStored(caches: Caches | undefined, base: string, ortPath: string): Promise<boolean> {
  if (!caches) return false
  try {
    if (!(await caches.has(MODEL_CACHE))) return false
    const cache = await caches.open(MODEL_CACHE)
    const found = await Promise.all(storedUrls(base, ortPath).map(url => cache.match(url)))
    return found.every(response => response !== undefined)
  }
  catch {
    return false
  }
}

/** Deletes the model's cache, and with it every model file, including a partial download. */
export async function removeModel(caches: Caches | undefined): Promise<void> {
  await caches?.delete(MODEL_CACHE).catch(() => false)
}

/**
 * Whether the browser says data is costly here: Save-Data is on, or the
 * connection is cellular. Most browsers report neither, which counts as no.
 */
export function isCostlyConnection(connection?: { saveData?: boolean, type?: string }): boolean {
  return connection?.saveData === true || connection?.type === 'cellular'
}
