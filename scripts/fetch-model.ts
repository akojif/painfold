// Runs before `nuxt generate` (and can run on its own: `npm run models`).
//
// 1. Downloads the name model (the exact Hugging Face revision in
//    deploy/model.ts, from its copy in a GitHub release or from Hugging Face) into node_modules/.cache (kept between builds by CI), and checks every file against its SHA-256. A mismatch fails the
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
export async function fetchWithRetry(url: string, options: { fetch?: typeof fetch, wait?: (ms: number) => Promise<unknown>, attempts?: number, init?: RequestInit } = {}): Promise<Response> {
  const { fetch: get = fetch, wait = sleep, attempts = 6, init } = options
  for (let attempt = 1; ; attempt++) {
    const last = attempt >= attempts
    let response: Response
    try {
      response = await get(url, init)
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

/**
 * A Hugging Face access token, if the build has one (HF_TOKEN): anonymous
 * downloads from shared build machines get rate-limited. Read-only is enough;
 * it is sent only to huggingface.co and never printed.
 */
export function huggingFaceInit(token = process.env.HF_TOKEN): RequestInit | undefined {
  const value = token?.trim()
  return value ? { headers: { authorization: `Bearer ${value}` } } : undefined
}

/** Where a model file can be downloaded, in order: the copy in a GitHub release, then Hugging Face (with HF_TOKEN, if set). */
export function sourcesFor(file: string, token = process.env.HF_TOKEN): Array<{ name: string, url: string, attempts: number, init?: RequestInit }> {
  const huggingFace = huggingFaceInit(token)
  return [
    { name: 'the GitHub release copy', url: `${NAME_MODEL.mirror}${file.split('/').at(-1)}`, attempts: 3 },
    { name: `Hugging Face (${huggingFace ? 'with a token' : 'without a token'})`, url: `https://huggingface.co/${NAME_MODEL.source}/resolve/${NAME_MODEL.revision}/${file}`, attempts: 6, init: huggingFace },
  ]
}

/**
 * Downloads a model file from the first source that gives exactly the
 * expected bytes. A failed download or a wrong file moves on to the next
 * source; if none works, the build fails with every reason.
 */
export async function download(file: string, expected: Expected, options: { fetch?: typeof fetch, wait?: (ms: number) => Promise<unknown>, token?: string } = {}): Promise<Uint8Array> {
  const problems: string[] = []
  for (const source of sourcesFor(file, 'token' in options ? options.token : process.env.HF_TOKEN)) {
    try {
      const response = await fetchWithRetry(source.url, { fetch: options.fetch, wait: options.wait, init: source.init, attempts: source.attempts })
      if (!response.ok) {
        problems.push(`${source.name}: ${response.status}`)
        continue
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!matches(bytes, expected)) {
        problems.push(`${source.name}: SHA-256 ${sha256(bytes)} and ${bytes.byteLength} bytes, expected ${expected.sha256} and ${expected.bytes}`)
        continue
      }
      console.log(`${file}: downloaded from ${source.name}.`)
      return bytes
    }
    catch (error) {
      problems.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`Downloading ${file} failed. ${problems.join('; ')}. Not using it.`)
}

export async function cachedFile(file: string, expected: Expected): Promise<string> {
  const path = join(CACHE, file)
  if (await readIfValid(path, expected)) return path

  const bytes = await download(file, expected)
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
