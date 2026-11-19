// Writes llms.txt into the build (.output/public), from the same sources as the
// site (scripts/llms-txt.ts). Run by `npm run generate`, after the pages.
import { writeFileSync } from 'node:fs'
import { llmsTxt, readSources } from './llms-txt.ts'

const out = '.output/public/llms.txt'
writeFileSync(out, llmsTxt(readSources()))
console.log(`Wrote ${out}`)
