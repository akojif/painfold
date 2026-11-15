// Runs before `nuxt generate` (and can run on its own: `npm run models`).
//
// 1. Downloads the name model from the exact Hugging Face revision in
//    deploy/model.ts into node_modules/.cache (kept between builds by CI), and checks every file against its SHA-256. A mismatch fails the
//    build, so a changed or tampered file never reaches users.
// 2. Copies the model to public/models/<id>/<revision>/ and the ONNX Runtime
//    WebAssembly files to public/ort/<version>/, so the app serves both from its
//    own origin: no request to Hugging Face or a CDN from users' browsers.
// Both folders under public/ are generated and ignored by git.
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MODEL_PATH, NAME_MODEL, ORT_FILES, ORT_PREFIX } from '../deploy/model.ts'
import { ortVersion } from '../deploy/ort-version.ts'

const CACHE = join('node_modules', '.cache', 'painfold-models', NAME_MODEL.id, NAME_MODEL.revision)
const PUBLIC = 'public'

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

type Expected = { sha256: string, bytes: number }

const matches = (bytes: Uint8Array, expected: Expected) => bytes.byteLength === expected.bytes && sha256(bytes) === expected.sha256

async function readIfValid(path: string, expected: Expected): Promise<Uint8Array | undefined> {
  const bytes = await readFile(path).catch(() => undefined)
  return bytes && matches(bytes, expected) ? bytes : undefined
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Fetches a URL, retrying when Hugging Face is busy or briefly unreachable:
 * on 429 (too many requests), 5xx and network errors, after the server's
 * Retry-After (capped at a minute) or 2, 4, 8, 16 and 32 seconds. Other
 * answers (such as 404) are returned at once. A shared build machine can hit
 * Hugging Face's rate limit, which once failed a production build.
 */
export async function fetchWithRetry(url: string, options: { fetch?: typeof fetch, wait?: (ms: number) => Promise<unknown>, attempts?: number } = {}): Promise<Response> {
  const { fetch: get = fetch, wait = sleep, attempts = 6 } = options
  for (let attempt = 1; ; attempt++) {
    const last = attempt >= attempts
    let response: Response
    try {
      response = await get(url)
    }
    catch (error) {
      if (last) throw error
      await wait(2000 * 2 ** (attempt - 1))
      continue
    }
    if (last || (response.status !== 429 && response.status < 500)) return response
    const after = Number(response.headers.get('retry-after'))
    const delay = Number.isFinite(after) && after > 0 ? Math.min(after, 60) * 1000 : 2000 * 2 ** (attempt - 1)
    console.log(`${url} answered ${response.status}; trying again in ${delay / 1000} s (attempt ${attempt + 1} of ${attempts}).`)
    await wait(delay)
  }
}

export async function cachedFile(file: string, expected: Expected): Promise<string> {
  const path = join(CACHE, file)
  if (await readIfValid(path, expected)) return path

  const url = `https://huggingface.co/${NAME_MODEL.source}/resolve/${NAME_MODEL.revision}/${file}`
  const response = await fetchWithRetry(url)
  if (!response.ok) throw new Error(`Downloading ${url} failed: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!matches(bytes, expected)) throw new Error(`${file} has SHA-256 ${sha256(bytes)} and ${bytes.byteLength} bytes, expected ${expected.sha256} and ${expected.bytes}. Not using it.`)

  await mkdir(dirname(path), { recursive: true })
  await writeFile(`${path}.part`, bytes)
  await rename(`${path}.part`, path)
  return path
}

async function main() {
  const modelDir = join(PUBLIC, MODEL_PATH)
  await rm(join(PUBLIC, 'models'), { recursive: true, force: true })
  for (const [file, expected] of Object.entries(NAME_MODEL.files)) {
    const source = await cachedFile(file, expected)
    await mkdir(dirname(join(modelDir, file)), { recursive: true })
    await copyFile(source, join(modelDir, file))
  }

  const version = ortVersion()
  const ortDir = join(PUBLIC, ORT_PREFIX, version)
  await rm(join(PUBLIC, ORT_PREFIX), { recursive: true, force: true })
  await mkdir(ortDir, { recursive: true })
  const dist = join('node_modules', 'onnxruntime-web', 'dist')
  for (const file of ORT_FILES) await copyFile(join(dist, file), join(ortDir, file))

  console.log(`Name model ${NAME_MODEL.source}@${NAME_MODEL.revision.slice(0, 7)} and ONNX Runtime ${version} ready in public/.`)
}

if (import.meta.main) await main()
