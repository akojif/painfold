// Selects the English v0.4 test texts from the CFPB complaint database, by the
// rules pre-registered in data/eval/analysis/runs-log.md, and writes them only
// into the git-ignored PRIVATE_DIR, then the English labelling sheet there.
// It prints counts, never a text.
//
//   node scripts/eval-v04-select.ts
//
// Run once, after the plan is committed and pushed. No key is needed: the
// CFPB publishes the narratives for anyone to use.
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { detect } from '../core/detect/index.ts'
import { cfpbDays, cfpbDayUrl, cfpbMasked, cfpbRecords, itemLine, PRIVATE_DIR, selectCfpb, type CfpbRecord } from './eval-v04.ts'

const records: CfpbRecord[] = []
const days = cfpbDays()
for (const [index, day] of days.entries()) {
  const response = await fetch(cfpbDayUrl(day), { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`CFPB answered ${response.status} for ${day}`)
  records.push(...cfpbRecords(await response.json()))
  if ((index + 1) % 20 === 0) console.log(`Queried ${index + 1} of ${days.length} days, ${records.length} narratives so far`)
  await new Promise(resolve => setTimeout(resolve, 300))
}

const { test, reserve } = selectCfpb(records)
mkdirSync(PRIVATE_DIR, { recursive: true })
const id = (index: number) => `en-cfpb-${String(index + 1).padStart(3, '0')}`
const reserveId = (index: number) => `en-cfpb-r${String(index + 1).padStart(2, '0')}`
writeFileSync(`${PRIVATE_DIR}/items-en.jsonl`, `${test.map((record, index) => itemLine(id(index), 'en', record.text)).join('\n')}\n`)
writeFileSync(`${PRIVATE_DIR}/reserve-en.jsonl`, `${reserve.map((record, index) => itemLine(reserveId(index), 'en', record.text)).join('\n')}\n`)
// The way back to the CFPB, kept private until the texts are committed.
writeFileSync(`${PRIVATE_DIR}/source-en.json`, `${JSON.stringify({
  source: 'CFPB Consumer Complaint Database',
  downloaded: new Date().toISOString(),
  days,
  items: [...test.map((record, index) => ({ id: id(index), complaint: record.id, product: record.product, date: record.date })), ...reserve.map((record, index) => ({ id: reserveId(index), complaint: record.id, product: record.product, date: record.date }))],
}, null, 2)}\n`)

// Personal data Painfold's rules still find, outside the CFPB's own masks: counts by type only.
const byType = new Map<string, number>()
let textsWithFindings = 0
for (const record of test) {
  const findings = detect(record.text).filter(finding => !cfpbMasked(record.text, finding.start, finding.end))
  if (findings.length > 0) textsWithFindings++
  for (const finding of findings) byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1)
}

execFileSync('python3', ['scripts/labelling/make_sheets.py', `${PRIVATE_DIR}/items-en.jsonl`, PRIVATE_DIR, 'labelling-v04'], { stdio: 'inherit' })

const products = new Map<string, number>()
for (const record of test) products.set(record.product, (products.get(record.product) ?? 0) + 1)
console.log(`\nNarratives found: ${records.length} on ${days.length} days`)
console.log(`Selected: ${test.length} test, ${reserve.length} reserve`)
console.log(`Products: ${[...products].map(([product, count]) => `${product} ${count}`).join('; ')}`)
console.log(`Texts with personal data found by the rules: ${textsWithFindings}; by type: ${[...byType].map(([type, count]) => `${type} ${count}`).join(', ') || 'none'}`)
console.log('Names are checked by the labeller in the sheet. Nothing else is printed.')
