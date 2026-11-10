// Generates Painfold's fake test data. Output is deterministic and committed;
// a unit test fails if the committed files differ from what this produces.
//
//   node scripts/generate-fake-data.ts                     write data/sample and data/eval
//   node scripts/generate-fake-data.ts --rows 5000 --out tmp/large.csv
//                                                          write a larger sample elsewhere
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { utils, write as writeWorkbook } from 'xlsx'
import { HARD_CASES } from './fake-data/hard-cases.ts'
import { LONG_TEXT_CASES } from './fake-data/long-texts.ts'
import { NAME_CASES } from './fake-data/names.ts'
import { mark, parseMarkup, type LabelledText } from './fake-data/markup.ts'
import { seededRandom, type Random } from './fake-data/random.ts'
import { TEMPLATES } from './fake-data/templates.ts'
import * as values from './fake-data/values.ts'
import type { Lang, Person } from './fake-data/values.ts'

export const SAMPLE_SEED = 20261109
export const EVAL_SEED = 41
export const SAMPLE_ROWS = 200
export const EVAL_ITEMS = 1200

export const SAMPLE_PATH = 'data/sample/support-tickets.csv'
export const SAMPLE_XLSX_PATH = 'data/sample/support-tickets.xlsx'
export const EVAL_GENERATED_PATH = 'data/eval/generated.jsonl'
export const EVAL_HARD_CASES_PATH = 'data/eval/hard-cases.jsonl'
export const EVAL_NAMES_PATH = 'data/eval/names.jsonl'
export const EVAL_LONG_TEXTS_PATH = 'data/eval/long-texts.jsonl'

function fillSlot(slot: string, random: Random, lang: Lang, who: Person): string {
  switch (slot) {
    case 'name': return mark('NAME', random.chance(0.7) ? `${who.first} ${who.last}` : who.first)
    case 'email': return mark('EMAIL', values.email(random, who))
    case 'phone': return mark('PHONE', values.phone(random, lang))
    case 'iban': return mark('IBAN', values.iban(random))
    case 'card': return mark('CARD', values.card(random))
    case 'svnr': return mark('SVNR', values.svnr(random))
    case 'vat': return mark('VAT_ID', values.vatId(random))
    case 'url': return mark('URL', values.url(random))
    case 'ip': return mark('IP', values.ip(random))
    case 'dob': return values.dateOfBirth(random, lang)
    case 'address': return values.address(random, lang)
    case 'order': return values.orderNumber(random)
    case 'version': return values.versionNumber(random)
    case 'invoice_date': return values.invoiceDate(random, lang)
    case 'amount': return values.amount(random, lang)
    case 'ticket': return values.ticketNumber(random)
    case 'bad_iban': return values.invalidIban(random)
    case 'bad_card': return values.invalidCard(random)
    default: throw new Error(`Unknown slot {${slot}}`)
  }
}

function message(random: Random, lang: Lang, who: Person, templates = TEMPLATES[lang]): LabelledText {
  const template = random.pick(templates)
  return parseMarkup(template.replace(/\{([a-z_]+)\}/g, (_, slot: string) => fillSlot(slot, random, lang, who)))
}

// ---- Sample file ----

const CHANNELS = ['Email', 'Chat', 'App review', 'NPS survey'] as const
const PLANS = ['Free', 'Solo', 'Team', 'Business'] as const

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export const SAMPLE_HEADER = ['id', 'created_at', 'channel', 'rating', 'plan', 'country', 'customer_name', 'customer_email', 'message']

/** The sample as rows of cells, header first. */
export function buildSampleRows(seed: number, rows: number): string[][] {
  const random = seededRandom(seed)
  const start = Date.UTC(2026, 0, 1)
  const span = Date.UTC(2026, 9, 31) - start
  const records = Array.from({ length: rows }, () => {
    const lang: Lang = random.chance(0.55) ? 'de' : 'en'
    const who = values.person(random, lang)
    const channel = random.pick(CHANNELS)
    const hasRating = channel === 'App review' || channel === 'NPS survey'
    return {
      date: new Date(start + Math.floor(random.next() * span)).toISOString().slice(0, 10),
      channel,
      rating: hasRating ? String(channel === 'NPS survey' ? random.int(0, 10) : random.int(1, 5)) : '',
      plan: random.pick(PLANS),
      country: lang === 'de' ? random.pick(['AT', 'AT', 'DE']) : random.pick(['GB', 'IE']),
      name: `${who.first} ${who.last}`,
      email: values.email(random, who),
      text: message(random, lang, who).text,
    }
  }).sort((a, b) => a.date.localeCompare(b.date))

  return [SAMPLE_HEADER, ...records.map((record, i) => [
    String(i + 1), record.date, record.channel, record.rating, record.plan, record.country, record.name, record.email, record.text,
  ])]
}

export function buildSample(seed: number, rows: number): string {
  return `${buildSampleRows(seed, rows).map(row => row.map(csvCell).join(',')).join('\n')}\n`
}

/** The same sample as an XLSX workbook, every cell stored as text. */
export function buildSampleXlsx(seed: number, rows: number): Uint8Array {
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(buildSampleRows(seed, rows)), 'Tickets')
  workbook.Props = { Title: 'Painfold sample (fake data)', CreatedDate: new Date(Date.UTC(2026, 10, 1)) }
  return writeWorkbook(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }) as Uint8Array
}

// ---- Evaluation set ----

type EvalItem = { id: string, lang: Lang, text: string, spans: LabelledText['spans'] }

const toJsonl = (items: EvalItem[]) => items.map(item => JSON.stringify(item)).join('\n') + '\n'

// Slots that hold personal data. The evaluation set rotates through them (and
// through templates without any) so every type gets enough examples to measure.
const PII_SLOTS = ['name', 'email', 'phone', 'iban', 'card', 'svnr', 'vat', 'url', 'ip', 'dob', 'address'] as const
const hasPiiSlot = (template: string) => PII_SLOTS.some(slot => template.includes(`{${slot}}`))

export function buildEvalGenerated(seed: number, count: number): string {
  const random = seededRandom(seed)
  const targets = [...PII_SLOTS, undefined]
  const items = Array.from({ length: count }, (_, i): EvalItem => {
    const lang: Lang = i % 2 === 0 ? 'de' : 'en'
    const target = targets[Math.floor(i / 2) % targets.length]
    const candidates = TEMPLATES[lang].filter(template => target ? template.includes(`{${target}}`) : !hasPiiSlot(template))
    const { text, spans } = message(random, lang, values.person(random, lang), candidates)
    return { id: `gen-${String(i + 1).padStart(4, '0')}`, lang, text, spans }
  })
  return toJsonl(items)
}

export function buildEvalHardCases(): string {
  return toJsonl(HARD_CASES.map(({ lang, source }, i) => ({
    id: `hard-${String(i + 1).padStart(3, '0')}`,
    lang,
    ...parseMarkup(source),
  })))
}

export function buildEvalNames(): string {
  return toJsonl(NAME_CASES.map(({ lang, group, split, source }, i) => ({
    id: `name-${String(i + 1).padStart(3, '0')}`,
    lang,
    group,
    split,
    ...parseMarkup(source),
  })))
}

export function buildEvalLongTexts(): string {
  return toJsonl(LONG_TEXT_CASES.map(({ lang, source }, i) => ({ id: `long-${String(i + 1).padStart(2, '0')}`, lang, ...parseMarkup(source) })))
}

async function write(path: string, content: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
  console.log(`Wrote ${path}`)
}

async function main() {
  const { values: args } = parseArgs({ options: { rows: { type: 'string' }, out: { type: 'string' } } })
  if (args.rows || args.out) {
    if (!args.rows || !args.out) throw new Error('--rows and --out go together')
    await write(args.out, buildSample(SAMPLE_SEED, Number(args.rows)))
    return
  }
  await write(SAMPLE_PATH, buildSample(SAMPLE_SEED, SAMPLE_ROWS))
  await write(SAMPLE_XLSX_PATH, buildSampleXlsx(SAMPLE_SEED, SAMPLE_ROWS))
  await write(EVAL_GENERATED_PATH, buildEvalGenerated(EVAL_SEED, EVAL_ITEMS))
  await write(EVAL_HARD_CASES_PATH, buildEvalHardCases())
  await write(EVAL_NAMES_PATH, buildEvalNames())
  await write(EVAL_LONG_TEXTS_PATH, buildEvalLongTexts())
}

if (import.meta.main) await main()
