// Uploads the name model to Cloudflare R2, where the Worker serves it from
// (deploy/worker.ts): `npm run models:upload` once for every new model revision,
// or with --local for wrangler's local copy of the bucket.
//
// Each file comes from the build's cache and is checked against its SHA-256 in
// deploy/model.ts first (scripts/fetch-model.ts), so only the pinned files can
// reach the bucket. The R2 key is the path the app requests, so a new revision
// never replaces the files of an old one.
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { MODEL_PATH, NAME_MODEL } from '../deploy/model.ts'
import { cachedFile } from './fetch-model.ts'

const BUCKET = 'painfold-models'
const CONTENT_TYPES: Record<string, string> = { json: 'application/json; charset=utf-8', onnx: 'application/octet-stream' }

const { values } = parseArgs({ options: { local: { type: 'boolean', default: false } } })

for (const [file, expected] of Object.entries(NAME_MODEL.files)) {
  const source = await cachedFile(file, expected)
  const key = `${MODEL_PATH.slice(1)}${file}`
  const type = CONTENT_TYPES[file.slice(file.lastIndexOf('.') + 1)]!
  const result = spawnSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', source, '--content-type', type, values.local ? '--local' : '--remote'], { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
  if (result.status !== 0) throw new Error(`Uploading ${key} failed.`)
}
console.log(`Name model ${NAME_MODEL.source}@${NAME_MODEL.revision.slice(0, 7)} uploaded to ${values.local ? 'the local' : 'the'} ${BUCKET} bucket.`)
