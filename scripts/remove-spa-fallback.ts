// Runs after `nuxt generate`. Nuxt also writes 200.html, a single-page-app
// fallback that static hosts such as Vercel serve for any unknown path, with
// status 200. Every Painfold page is prerendered, so the fallback is not
// needed; without it, unknown paths get 404.html with a real 404 status.
import { rm } from 'node:fs/promises'

await rm('.output/public/200.html', { force: true })
