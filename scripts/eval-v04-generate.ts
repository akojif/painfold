// Generates the German v0.4 test texts with Mistral Large from the committed
// brief (data/eval/analysis/v04/german-brief.md), only if the GermEval data
// cannot be used. Writes them only into the git-ignored PRIVATE_DIR, then the
// German labelling sheet there, and prints counts, never a text.
//
//   MISTRAL_API_KEY=… node scripts/eval-v04-generate.ts --dry-run   # 5 texts, discarded unread; prints tokens
//   MISTRAL_API_KEY=… node scripts/eval-v04-generate.ts             # the 100 texts
//
// The key is read from the environment and never printed or stored.
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { batchMessage, buildSlots, checkText, dropReport, itemLine, PRIVATE_DIR, SYSTEM_MESSAGE, type Slot, type SlotOutcome } from './eval-v04.ts'

export const MODEL = 'mistral-large-latest'
export const TEMPERATURE = 0.8
const BATCH = 5

const key = process.env.MISTRAL_API_KEY?.trim()
if (!key) throw new Error('Set MISTRAL_API_KEY (it is never printed or stored).')
const dryRun = process.argv.includes('--dry-run')

let tokensIn = 0
let tokensOut = 0
const models = new Set<string>()

/** One request for a batch of slots; returns the text per slot, or nothing for a slot the answer lacks. */
async function generate(slots: readonly Slot[]): Promise<Map<number, string>> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_MESSAGE }, { role: 'user', content: batchMessage(slots) }],
    }),
  })
  if (!response.ok) throw new Error(`Mistral answered ${response.status}`)
  const answer = await response.json() as { model?: string, usage?: { prompt_tokens?: number, completion_tokens?: number }, choices?: { message?: { content?: string } }[] }
  tokensIn += answer.usage?.prompt_tokens ?? 0
  tokensOut += answer.usage?.completion_tokens ?? 0
  if (answer.model) models.add(answer.model)
  const texts = new Map<number, string>()
  try {
    const parsed = JSON.parse(answer.choices?.[0]?.message?.content ?? '{}') as { texts?: { slot?: unknown, text?: unknown }[] }
    for (const entry of parsed.texts ?? []) if (typeof entry.slot === 'number' && typeof entry.text === 'string') texts.set(entry.slot, entry.text)
  }
  catch {
    // An unreadable answer leaves every slot of the batch without a text; they are regenerated once.
  }
  return texts
}

const slots = buildSlots()

if (dryRun) {
  await generate(slots.slice(0, BATCH))
  console.log(`Dry run: ${BATCH} texts generated and discarded unread. Model ${[...models].join(', ')}; tokens in ${tokensIn}, out ${tokensOut}.`)
  process.exit(0)
}

const accepted = new Map<number, string>()
const failedOnce: Slot[] = []
for (let start = 0; start < slots.length; start += BATCH) {
  const batch = slots.slice(start, start + BATCH)
  const texts = await generate(batch)
  for (const slot of batch) {
    const text = texts.get(slot.slot)
    if (checkText(slot, text, [...accepted.values()]).length === 0) accepted.set(slot.slot, text!)
    else failedOnce.push(slot)
  }
}

// Each failed slot is regenerated once; if it fails again, it is dropped.
const outcomes: SlotOutcome[] = slots.filter(slot => !failedOnce.includes(slot)).map(slot => ({ slot, regenerated: false, dropped: false }))
const failureCounts = new Map<string, number>()
for (let start = 0; start < failedOnce.length; start += BATCH) {
  const batch = failedOnce.slice(start, start + BATCH)
  const texts = await generate(batch)
  for (const slot of batch) {
    const failures = checkText(slot, texts.get(slot.slot), [...accepted.values()])
    if (failures.length === 0) accepted.set(slot.slot, texts.get(slot.slot)!)
    for (const failure of failures) failureCounts.set(failure, (failureCounts.get(failure) ?? 0) + 1)
    outcomes.push({ slot, regenerated: true, dropped: failures.length > 0 })
  }
}

const report = dropReport(outcomes)
const table = (groups: Record<string, { regenerated: number, dropped: number }>) => Object.entries(groups).map(([group, value]) => `${group}: ${value.regenerated} regenerated, ${value.dropped} dropped`).join('; ')
console.log(`Model ${[...models].join(', ')}, temperature ${TEMPERATURE}; tokens in ${tokensIn}, out ${tokensOut}`)
console.log(`Accepted ${accepted.size} of ${slots.length}`)
console.log(`By language variety: ${table(report.byVariety)}`)
console.log(`By special feature: ${table(report.byFeature)}`)
console.log(`Failed checks on the second try: ${[...failureCounts].map(([failure, count]) => `${failure} ${count}`).join(', ') || 'none'}`)

if (report.stop) {
  // Pre-registered: more than 2 of any group's slots dropped stops before labelling. Nothing is written.
  console.log(`\nStopped before labelling: more than 2 slots dropped in ${report.tooMany.join(', ')}. Nothing was written.`)
  process.exit(1)
}

mkdirSync(PRIVATE_DIR, { recursive: true })
const id = (slot: number) => `de-gen-${String(slot).padStart(3, '0')}`
const kept = slots.filter(slot => accepted.has(slot.slot))
writeFileSync(`${PRIVATE_DIR}/items-de.jsonl`, `${kept.map(slot => itemLine(id(slot.slot), 'de', accepted.get(slot.slot)!)).join('\n')}\n`)
writeFileSync(`${PRIVATE_DIR}/source-de.json`, `${JSON.stringify({ source: 'generated', model: [...models], temperature: TEMPERATURE, generated: new Date().toISOString(), slots: kept.map(slot => ({ id: id(slot.slot), channel: slot.channel.key, length: slot.length.key, variety: slot.variety.key, topic: slot.topic, feature: slot.feature.key, tone: slot.tone })) }, null, 2)}\n`)
execFileSync('python3', ['scripts/labelling/make_sheets.py', `${PRIVATE_DIR}/items-de.jsonl`, PRIVATE_DIR, 'labelling-v04'], { stdio: 'inherit' })
console.log('Written to the private folder. Nothing else is printed.')
