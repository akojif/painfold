import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEMO_FORMAT, replayDemo, type DemoRun } from '../../core/ai/demo'
import { labelKey, labelsOf } from '../../core/ai/merge'
import { BATCH_SIZE, INSTRUCTIONS, mergeInstructions, PAYLOAD_FORMAT } from '../../core/ai/payload'
import { EFFORT, MAX_TOKENS, quoteFits, type TaggedText } from '../../core/ai/tagging'
import { countThemes } from '../../core/ai/themes'
import { detect } from '../../core/detect'
import { readCsv } from '../../core/import/csv'

// The demo (#130): a stored real run on the sample file, replayed in the app
// by the live code. These tests fail when the stored run no longer fits the
// current code, prompts or settings; then run `npm run demo:generate`.
const demo = JSON.parse(readFileSync('data/demo/analysis.json', 'utf8')) as DemoRun
const REGENERATE = 'The stored demo no longer matches: run `npm run demo:generate`.'

describe('the stored demo run', () => {
  it('is a real model run, not the stand-in used while building', () => {
    expect(demo.standIn, 'data/demo/analysis.json holds invented answers').toBe(false)
  })

  it('has the current format, instructions and settings', () => {
    expect(demo.format).toBe(DEMO_FORMAT)
    expect(demo.payload.format, REGENERATE).toBe(PAYLOAD_FORMAT)
    expect(demo.payload.instructions, REGENERATE).toBe(INSTRUCTIONS)
    expect(demo.payload.mergeInstructions, REGENERATE).toBe(mergeInstructions('en'))
    expect(demo.settings, REGENERATE).toEqual({ batchSize: BATCH_SIZE, effort: EFFORT, maxTokens: MAX_TOKENS })
    expect(demo.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(demo.model).toMatch(/^claude-/)
  })

  for (const language of ['en', 'de'] as const) {
    it(`replays through the live code with nothing lost (${language})`, async () => {
      const { result, merge, itemOf, payload } = await replayDemo(demo, language)
      expect(result.stopped, REGENERATE).toBeUndefined()
      expect(result.failed.size, REGENERATE).toBe(0)
      expect(result.tagged.size).toBe(payload.texts.length)
      expect(merge.stopped, REGENERATE).toBeUndefined()

      const themes = countThemes(result.tagged, merge.themes, itemOf)
      expect(themes.jobs.length + themes.pains.length + themes.gains.length).toBeGreaterThan(0)
      // Every label found is in a merged theme: none was left over because the asked labels changed.
      const merged = new Set(Object.values(merge.themes).flat().flatMap(theme => theme.labels))
      for (const kind of ['jobs', 'pains', 'gains'] as const) {
        for (const label of labelsOf(result.tagged.values(), kind)) expect(merged.has(labelKey(label.label)), `${kind}: ${label.label}`).toBe(true)
      }
      // Every quote shown is in the stored text, word for word.
      const textOf = new Map(payload.texts.map(text => [itemOf.get(text.id), text.text]))
      for (const theme of Object.values(themes).flat()) {
        for (const quote of theme.quotes) expect(quoteFits(quote.quote, textOf.get(quote.item)!)).toBe(true)
      }
    })
  }

  it('knows the row and kept values of every item it names', () => {
    for (const [, item] of demo.itemOf) expect(demo.items[item], item).toMatchObject({ row: expect.any(Number) })
  })

  it('holds no personal data the rules find, and none of the sample\'s customer names', () => {
    for (const { id, text } of demo.payload.texts) expect(detect(text).map(found => `${found.type} ${found.value}`), id).toEqual([])
    const sample = readCsv('support-tickets.csv', new Uint8Array(readFileSync('data/sample/support-tickets.csv')))
    const column = sample.columns.indexOf('customer_name')
    const names = new Set(sample.rows.map(row => row[column]!).filter(Boolean))
    const texts = demo.payload.texts.map(text => text.text).join('\n')
    for (const name of names) expect(texts, name).not.toContain(name)
  })
})

describe('label ids', () => {
  it('follow the file, not the order the answers arrived in, so a stored run replays exactly', () => {
    const text = (id: string, label: string): TaggedText => ({ id, jobs: [], pains: [{ label, intensity: 2 }], gains: [], sentiment: 'negative', type: 'complaint' })
    const inFileOrder = [text('t1', 'Slow export'), text('t2', 'Login fails'), text('t10', 'Wrong address')]
    const arrived = [inFileOrder[2]!, inFileOrder[0]!, inFileOrder[1]!]
    expect(labelsOf(arrived, 'pains')).toEqual(labelsOf(inFileOrder, 'pains'))
    expect(labelsOf(arrived, 'pains').map(label => label.label)).toEqual(['Slow export', 'Login fails', 'Wrong address'])
  })
})
