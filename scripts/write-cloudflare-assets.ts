// Runs after `nuxt generate`. Writes two files into the build for Cloudflare
// (wrangler.jsonc), which reads them and never serves them:
// - _headers, the security headers from deploy/headers.ts;
// - .assetsignore, which leaves the name model out of the static files: the
//   Worker serves it from R2 (deploy/worker.ts), because its largest file is
//   over Cloudflare's 25 MiB limit for a static file.
// Other hosts ignore both files.
import { writeFile } from 'node:fs/promises'
import { cloudflareHeaders, MODEL_PREFIX } from '../deploy/headers.ts'

await writeFile('.output/public/_headers', cloudflareHeaders())
await writeFile('.output/public/.assetsignore', `${MODEL_PREFIX.slice(1)}\n`)
