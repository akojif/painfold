import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PII_TYPES } from '../../core/pii-types'
import { parseMarkup } from '../../scripts/fake-data/markup'
import { NAME_GROUPS } from '../../scripts/fake-data/names'
import { seededRandom } from '../../scripts/fake-data/random'
import { isValidIban, isValidLuhn, isValidSvnr, isValidVatId } from '../../scripts/fake-data/values'
import {
  buildEvalGenerated, buildEvalHardCases, buildEvalNames, buildSample, buildSampleXlsx,
  EVAL_GENERATED_PATH, EVAL_HARD_CASES_PATH, EVAL_LONG_TEXTS_PATH, EVAL_NAMES_PATH, EVAL_ITEMS, EVAL_SEED, SAMPLE_PATH, SAMPLE_ROWS, SAMPLE_SEED, SAMPLE_XLSX_PATH,
} from '../../scripts/generate-fake-data'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

type Span = { start: number, end: number, type: string, text: string }
type Item = { id: string, lang: string, text: string, spans: Span[] }
const evalItems: Item[] = [EVAL_GENERATED_PATH, EVAL_HARD_CASES_PATH, EVAL_NAMES_PATH, EVAL_LONG_TEXTS_PATH]
  .flatMap(path => read(path).trim().split('\n').map(line => JSON.parse(line) as Item))
const spansOf = (type: string) => evalItems.flatMap(item => item.spans.filter(span => span.type === type))

// Minimal RFC 4180 reader, enough to check the sample file's shape.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]]
  let cell = ''
  let quoted = false
  const endCell = () => {
    rows.at(-1)!.push(cell)
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted && char === '"' && text[i + 1] === '"') {
      cell += '"'
      i++
    }
    else if (char === '"') {
      quoted = !quoted
    }
    else if (!quoted && char === ',') {
      endCell()
    }
    else if (!quoted && char === '\n') {
      endCell()
      rows.push([])
    }
    else {
      cell += char
    }
  }
  if (rows.at(-1)!.length === 0 && cell === '') rows.pop()
  return rows
}

describe('committed fake data', () => {
  it('is exactly what the generator produces (run `node scripts/generate-fake-data.ts`)', () => {
    expect(read(SAMPLE_PATH)).toBe(buildSample(SAMPLE_SEED, SAMPLE_ROWS))
    expect(read(EVAL_GENERATED_PATH)).toBe(buildEvalGenerated(EVAL_SEED, EVAL_ITEMS))
    expect(read(EVAL_HARD_CASES_PATH)).toBe(buildEvalHardCases())
    expect(read(EVAL_NAMES_PATH)).toBe(buildEvalNames())
    const committedXlsx = readFileSync(new URL(`../../${SAMPLE_XLSX_PATH}`, import.meta.url))
    expect(Buffer.compare(committedXlsx, Buffer.from(buildSampleXlsx(SAMPLE_SEED, SAMPLE_ROWS)))).toBe(0)
  })

  it('contains no email address outside the reserved example domains', () => {
    for (const path of [SAMPLE_PATH, EVAL_GENERATED_PATH, EVAL_HARD_CASES_PATH, EVAL_NAMES_PATH]) {
      for (const [address] of read(path).matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
        // \b, not $: a hard case leaves out the space after the full stop ("example.com.Danke").
        expect(address.toLowerCase(), path).toMatch(/@(?:mail\.)?example\.(?:com|org|net)\b/)
      }
    }
  })
})

describe('sample file', () => {
  const rows = parseCsv(read(SAMPLE_PATH))

  it('has a header and one row per item, all with the same columns', () => {
    expect(rows[0]).toEqual(['id', 'created_at', 'channel', 'rating', 'plan', 'country', 'customer_name', 'customer_email', 'message'])
    expect(rows).toHaveLength(SAMPLE_ROWS + 1)
    for (const row of rows) expect(row).toHaveLength(9)
  })

  it('includes German and English messages, multi-line cells and quotes', () => {
    const messages = rows.slice(1).map(row => row[8]!)
    expect(messages.some(text => /[äöüß]/.test(text))).toBe(true)
    expect(messages.some(text => text.includes('\n'))).toBe(true)
    expect(messages.some(text => text.includes('"'))).toBe(true)
  })
})

describe('evaluation set', () => {
  it('has spans that match the text exactly, in order and without overlap', () => {
    for (const item of evalItems) {
      let previousEnd = 0
      for (const span of item.spans) {
        expect(item.text.slice(span.start, span.end), item.id).toBe(span.text)
        expect(span.start, item.id).toBeGreaterThanOrEqual(previousEnd)
        expect(PII_TYPES, item.id).toContain(span.type)
        previousEnd = span.end
      }
    }
  })

  it('has at least 50 examples of every type per language', () => {
    for (const type of PII_TYPES) {
      for (const lang of ['de', 'en']) {
        const count = evalItems.filter(item => item.lang === lang).flatMap(item => item.spans).filter(span => span.type === type).length
        expect(count, `${type} ${lang}`).toBeGreaterThanOrEqual(50)
      }
    }
  })

  it('has items without personal data in both languages, for measuring false positives', () => {
    for (const lang of ['de', 'en']) {
      expect(evalItems.filter(item => item.lang === lang && item.spans.length === 0).length).toBeGreaterThanOrEqual(50)
    }
  })

  it('labels only checksum-valid IBANs, cards, SV-Nummern and VAT IDs', () => {
    // Hard cases write some of them with dashes, dots or spaces, as people do.
    const plain = (text: string) => text.replace(/[\s.-]/g, '')
    for (const span of spansOf('IBAN')) expect(isValidIban(plain(span.text)), span.text).toBe(true)
    for (const span of spansOf('CARD')) expect(isValidLuhn(plain(span.text)), span.text).toBe(true)
    for (const span of spansOf('SVNR')) expect(isValidSvnr(plain(span.text)), span.text).toBe(true)
    for (const span of spansOf('VAT_ID')) expect(isValidVatId(plain(span.text)), span.text).toBe(true)
  })

  it('uses only documentation IP ranges and example domains in URLs', () => {
    for (const span of spansOf('IP')) expect(span.text).toMatch(/^(?:192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|2001:db8:)/)
    for (const span of spansOf('URL')) expect(span.text).toMatch(/^(?:https?:\/\/)?(?:(?:[\w-]+\.)?example\.(?:com|org|net)|(?:192\.0\.2|198\.51\.100|203\.0\.113)\.\d+)\//)
  })

  it('uses fictional ranges for German and UK phone numbers', () => {
    for (const span of spansOf('PHONE')) {
      const digits = span.text.replace(/\D/g, '')
      if (/^(?:0049|49|0)30/.test(digits)) expect(digits, span.text).toMatch(/23125\d{3}$/)
      if (/^(?:0044|44|0)7700/.test(digits)) expect(digits, span.text).toMatch(/7700900\d{3}$/)
      if (/^(?:0044|44|0)20/.test(digits)) expect(digits, span.text).toMatch(/20?79460\d{3}$/)
    }
  })
})

describe('hand-written name set', () => {
  type NameItem = Item & { group?: string, split: 'dev' | 'test' }
  const all = read(EVAL_NAMES_PATH).trim().split('\n').map(line => JSON.parse(line) as NameItem)
  // Look-alikes (greetings followed by words that are not names) belong to no group.
  const items = all.filter(item => item.group !== undefined)
  const names = (filter: (item: NameItem) => boolean) => items.filter(filter).flatMap(item => item.spans.filter(span => span.type === 'NAME'))

  it('covers every name-origin group in German and English sentences', () => {
    expect(new Set(items.map(item => item.group))).toEqual(new Set(NAME_GROUPS))
    for (const group of NAME_GROUPS) {
      for (const lang of ['de', 'en']) expect(names(item => item.group === group && item.lang === lang).length, `${group} ${lang}`).toBeGreaterThanOrEqual(6)
    }
  })

  it('has at least 25 test names and 3 dev names per group, so a single miss does not decide the target', () => {
    for (const group of NAME_GROUPS) {
      expect(names(item => item.group === group && item.split === 'test').length, group).toBeGreaterThanOrEqual(25)
      expect(names(item => item.group === group && item.split === 'dev').length, group).toBeGreaterThanOrEqual(3)
    }
  })

  it('has dev-only look-alikes in both languages, after the grouped cases', () => {
    const lookAlikes = all.filter(item => item.group === undefined)
    expect(lookAlikes.every(item => item.split === 'dev')).toBe(true)
    for (const lang of ['de', 'en']) expect(lookAlikes.filter(item => item.lang === lang).length, lang).toBeGreaterThanOrEqual(10)
    expect(all.slice(-lookAlikes.length)).toEqual(lookAlikes)
  })

  it('includes diacritics, transliteration variants, multi-part and particle names', () => {
    const all = names(() => true).map(span => span.text).join(' ')
    for (const letter of ['ć', 'š', 'ž', 'ğ', 'ı', 'ș', 'ő', 'ł']) expect(all, letter).toContain(letter)
    for (const variant of ['Mohammed', 'Muhammad', 'Mohamad', 'Mohammad']) expect(all, variant).toContain(variant)
    for (const name of ['Abdul Rahman Darwish', 'Mohammed Al-Hassan', 'Sanne van der Berg']) expect(all, name).toContain(name)
  })
})

describe('generator building blocks', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    expect(Array.from({ length: 5 }, a.next)).toEqual(Array.from({ length: 5 }, b.next))
  })

  it('validates the published reference values', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('AT61 1904 3002 3457 3202')).toBe(false)
    expect(isValidSvnr('1237 010180')).toBe(true)
    expect(isValidSvnr('1238 010180')).toBe(false)
    expect(isValidVatId('ATU13585627')).toBe(true)
    expect(isValidVatId('DE136695976')).toBe(true)
    expect(isValidVatId('DE136695977')).toBe(false)
    expect(isValidLuhn('4111 1111 1111 1111')).toBe(true)
    expect(isValidLuhn('4111 1111 1111 1112')).toBe(false)
  })

  it('turns markup into text with exact spans', () => {
    expect(parseMarkup('Mail [[EMAIL:a@example.com]] or call [[PHONE:030 23125000]].')).toEqual({
      text: 'Mail a@example.com or call 030 23125000.',
      spans: [
        { start: 5, end: 18, type: 'EMAIL', text: 'a@example.com' },
        { start: 27, end: 39, type: 'PHONE', text: '030 23125000' },
      ],
    })
  })

  it('rejects unknown types and unclosed markup', () => {
    expect(() => parseMarkup('[[SHOE:42]]')).toThrow()
    expect(() => parseMarkup('[[EMAIL:a@example.com')).toThrow()
  })
})
