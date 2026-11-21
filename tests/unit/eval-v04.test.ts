import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { batchMessage, buildSlots, CFPB_RULES, cfpbDays, cfpbMasked, cfpbRecords, CHANNELS, checkText, dropReport, FEATURES, LENGTHS, selectCfpb, SYSTEM_MESSAGE, TOPICS, VARIETIES, type CfpbRecord, type Slot } from '../../scripts/eval-v04'

// The v0.4 test set's selection and generation logic (pre-registered in
// data/eval/analysis/runs-log.md). Every record and text here is invented.

const countBy = <T>(items: readonly T[], key: (item: T) => string) => items.reduce<Record<string, number>>((all, item) => ({ ...all, [key(item)]: (all[key(item)] ?? 0) + 1 }), {})

describe('German slot plan', () => {
  const slots = buildSlots()

  it('has 100 slots with every share exact', () => {
    expect(slots).toHaveLength(100)
    expect(countBy(slots, slot => slot.channel.key)).toEqual(Object.fromEntries(CHANNELS.map(item => [item.key, item.count])))
    expect(countBy(slots, slot => slot.length.key)).toEqual(Object.fromEntries(LENGTHS.map(item => [item.key, item.count])))
    expect(countBy(slots, slot => slot.variety.key)).toEqual(Object.fromEntries(VARIETIES.map(item => [item.key, item.count])))
    expect(countBy(slots, slot => slot.feature.key)).toEqual(Object.fromEntries(FEATURES.map(item => [item.key, item.count])))
    expect(Object.values(countBy(slots, slot => slot.topic))).toEqual(TOPICS.map(() => 4))
  })

  it('is the same on every run', () => {
    expect(buildSlots()).toEqual(slots)
    expect(buildSlots(1)).not.toEqual(slots)
  })

  it('asks for placeholders only in the "already cleaned" orders, and no personal data at all in the others', () => {
    expect(SYSTEM_MESSAGE).toContain('Nur Aufträge mit der Besonderheit „Enthält ein bis drei Platzhalter“ enthalten Platzhalter')
    expect(SYSTEM_MESSAGE).toContain('Alle anderen Rückmeldungen enthalten keinerlei personenbezogene Daten')
    const cleaned = slots.find(slot => slot.feature.key === 'cleaned')!
    const ordinary = slots.find(slot => slot.feature.key === 'ordinary')!
    expect(batchMessage([cleaned])).toContain('Platzhalter')
    expect(batchMessage([ordinary])).not.toContain('Platzhalter')
    expect(batchMessage([cleaned, ordinary])).toMatch(/^Schreibe 2 Rückmeldungen\./)
  })
})

describe('checks on a generated text', () => {
  const slots = buildSlots()
  const slotOf = (feature: string, length: string) => ({ ...slots.find(slot => slot.feature.key === feature)!, length: LENGTHS.find(item => item.key === length)! }) as Slot
  const medium = 'Seit dem letzten Update der App kann ich Überweisungen nicht mehr freigeben, die Push-Nachricht kommt einfach nicht an. Ich habe die App schon zweimal neu installiert.'

  it('passes a fitting text', () => {
    expect(checkText(slotOf('ordinary', 'medium'), medium, [])).toEqual([])
  })

  it('wants one to three placeholders in an "already cleaned" text, and none elsewhere', () => {
    expect(checkText(slotOf('cleaned', 'medium'), medium, [])).toContain('placeholdersMissing')
    expect(checkText(slotOf('cleaned', 'medium'), `${medium} Grüße, [NAME_1]`, [])).toEqual([])
    expect(checkText(slotOf('ordinary', 'medium'), `${medium} Grüße, [NAME_1]`, [])).toContain('placeholdersNotAllowed')
  })

  it('rejects personal data, a real bank, a wrong length, an empty answer and a near duplicate', () => {
    expect(checkText(slotOf('ordinary', 'medium'), `${medium} Schreiben Sie an anna.beispiel@example.com.`, [])).toContain('personalData')
    expect(checkText(slotOf('ordinary', 'medium'), `${medium} Bei der Sparkasse geht das.`, [])).toContain('realBank')
    expect(checkText(slotOf('ordinary', 'short'), medium, [])).toContain('length')
    expect(checkText(slotOf('ordinary', 'medium'), '  ', [])).toEqual(['missing'])
    expect(checkText(slotOf('ordinary', 'medium'), medium, [`${medium} Danke.`])).toContain('duplicate')
  })
})

describe('drops', () => {
  const slots = buildSlots()
  it('counts regenerated and dropped slots by variety and feature, and stops when a group loses more than 2', () => {
    const austrian = slots.filter(slot => slot.variety.key === 'de-AT')
    const two = dropReport(austrian.slice(0, 2).map(slot => ({ slot, regenerated: true, dropped: true })))
    expect(two.stop).toBe(false)
    expect(two.byVariety['de-AT']).toEqual({ regenerated: 2, dropped: 2 })
    const three = dropReport(austrian.slice(0, 3).map(slot => ({ slot, regenerated: true, dropped: true })))
    expect(three.stop).toBe(true)
    expect(three.tooMany).toContain('de-AT')
  })
})

describe('English selection from the CFPB', () => {
  const text = (n: number) => `Invented complaint ${n}: the bank charged a fee twice and nobody answered my messages for three weeks, although I called the hotline every day and wrote twice.`
  const record = (n: number, company: string, product: string, date = '2025-05-01'): CfpbRecord => ({ id: String(1000 + n), text: text(n), company, product, date })

  it('queries the same 120 days of the year on every run', () => {
    const days = cfpbDays()
    expect(days).toHaveLength(CFPB_RULES.days)
    expect(new Set(days).size).toBe(days.length)
    expect(days.every(day => day.startsWith('2025-'))).toBe(true)
    expect(cfpbDays()).toEqual(days)
  })

  it('keeps the pre-registered rules: year, length, no duplicates, at most 2 per company', () => {
    const records = [
      ...Array.from({ length: 30 }, (_, n) => record(n, `Bank ${n % 10}`, n % 2 ? 'Credit card' : 'Checking or savings account')),
      record(100, 'Bank X', 'Mortgage', '2024-12-31'),
      { ...record(101, 'Bank Y', 'Mortgage'), text: 'Too short.' },
      { ...record(102, 'Bank Z', 'Mortgage'), id: '9999', text: text(1) },
    ]
    const { test, reserve } = selectCfpb(records, 7, 15, 5)
    const all = [...test, ...reserve]
    expect(all).toHaveLength(20)
    expect(all.every(item => item.date.startsWith('2025') && item.text.length >= 150)).toBe(true)
    expect(new Set(all.map(item => item.text)).size).toBe(all.length)
    expect(Math.max(...Object.values(countBy(all, item => item.company)))).toBeLessThanOrEqual(2)
    expect(new Set(test.map(item => item.product)).size).toBe(2)
    expect(selectCfpb(records, 7, 15, 5)).toEqual({ test, reserve })
  })

  it('reads the API answer in either shape, and names an unknown shape without any text', () => {
    const source = { complaint_id: 1, complaint_what_happened: 'Invented narrative.', product: 'Mortgage', company: 'Bank', date_received: '2025-02-03T12:00:00' }
    expect(cfpbRecords({ hits: { hits: [{ _source: source }] } })).toEqual([{ id: '1', text: 'Invented narrative.', product: 'Mortgage', company: 'Bank', date: '2025-02-03' }])
    expect(cfpbRecords([source])).toHaveLength(1)
    expect(() => cfpbRecords({ error: 'x' })).toThrow('Unexpected CFPB answer: keys error')
  })

  it("treats the CFPB's own masks as already removed", () => {
    const masked = 'On XX/XX/XXXX I called XXXX.'
    expect(cfpbMasked(masked, 3, 13)).toBe(true)
    expect(cfpbMasked(masked, 24, 28)).toBe(true)
    expect(cfpbMasked('Call 0151 2345678', 5, 17)).toBe(false)
  })
})

describe('the committed brief', () => {
  const brief = readFileSync('data/eval/analysis/v04/german-brief.md', 'utf8')

  it('holds the system message the script sends, word for word', () => {
    const quoted = brief.split('\n').filter(line => line.startsWith('>')).map(line => line.replace(/^> ?/, '')).join('\n')
    expect(quoted).toBe(SYSTEM_MESSAGE)
  })

  it('names every special feature in the words the script sends, and every topic and share', () => {
    for (const feature of FEATURES) expect(brief).toContain(feature.de)
    for (const [list, total] of [[CHANNELS, 100], [LENGTHS, 100], [VARIETIES, 100], [FEATURES, 100]] as const) expect(list.reduce((sum, item) => sum + item.count, 0)).toBe(total)
    expect(TOPICS).toHaveLength(25)
  })
})
