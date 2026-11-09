// Writes vercel.json from deploy/headers.ts. A unit test fails if the committed
// file is out of date, so run this after changing the headers.
import { writeFile } from 'node:fs/promises'
import { vercelConfig } from '../deploy/headers.ts'

await writeFile('vercel.json', `${JSON.stringify(vercelConfig(), null, 2)}\n`)
console.log('vercel.json written.')
