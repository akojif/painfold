import { describe, expect, it } from 'vitest'
import { checkMerge, labelsOf, MERGE_CHUNK, MERGE_SCHEMA, mergeContent, runMerge, type MergeLabel } from '../../core/ai/merge'
import type { BatchReply } from '../../core/ai/run'
import type { Tag, TaggedText } from '../../core/ai/tagging'
import { countThemes, LOW_CONFIDENCE_BELOW } from '../../core/ai/themes'

// Merging and counting (#127). All texts and labels are invented.
const tag = (label: string, intensity: Tag['intensity'] = 2, quote?: string): Tag => ({ label, intensity, ...(quote ? { quote } : {}) })
function text(id: string, pains: Tag[], extra: Partial<TaggedText> = {}): TaggedText {
  return { id, jobs: [], pains, gains: [], sentiment: 'negative', type: 'complaint', ...extra }
}
const mapOf = (texts: TaggedText[]) => new Map(texts.map(entry => [entry.id, entry]))
const never = () => new AbortController().signal
const noWait = async () => {}

/** An Anthropic answer body holding this JSON. */
const body = (json: unknown): BatchReply => ({ ok: true, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 10, output_tokens: 5 } }) })

/** A merge answer that groups labels by their first word, named after it. */
function byFirstWord(content: string): BatchReply {
  const { labels } = JSON.parse(content) as { labels: MergeLabel[] }
  const groups = new Map<string, string[]>()
  for (const { id, label } of labels) {
    const word = label.split(' ')[0]!.toLowerCase()
    groups.set(word, [...(groups.get(word) ?? []), id])
  }
  return body({ themes: [...groups].map(([name, ids]) => ({ name: `About ${name}`, labels: ids })) })
}

describe('labels', () => {
  it('lists each kind\'s distinct labels once per text, ignoring case and spacing, most frequent first', () => {
    const texts = [
      text('t1', [tag('Slow export'), tag('slow  export')]),
      text('t2', [tag('Login fails')]),
      text('t3', [tag('SLOW EXPORT')]),
    ]
    expect(labelsOf(texts, 'pains')).toEqual([
      { id: 'l1', label: 'Slow export', count: 2 },
      { id: 'l2', label: 'Login fails', count: 1 },
    ])
    expect(labelsOf(texts, 'jobs')).toEqual([])
  })

  it('sends only the kind and the labels: never a text, a quote or an item id', () => {
    const texts = [text('t1', [tag('Slow export', 3, 'the export takes forever')])]
    const content = mergeContent('pains', labelsOf(texts, 'pains'))
    expect(JSON.parse(content)).toEqual({ kind: 'pains', labels: [{ id: 'l1', label: 'Slow export', count: 1 }] })
    expect(content).not.toContain('forever')
    expect(content).not.toContain('t1')
  })

  it('every object in the schema forbids extra fields, as structured output requires', () => {
    expect(MERGE_SCHEMA.additionalProperties).toBe(false)
    expect(MERGE_SCHEMA.properties.themes.items.additionalProperties).toBe(false)
  })
})

describe('checkMerge', () => {
  const labels: MergeLabel[] = [
    { id: 'l1', label: 'Slow export', count: 5 },
    { id: 'l2', label: 'Export hangs', count: 2 },
    { id: 'l3', label: 'Login fails', count: 1 },
  ]

  it('keeps a label in its first theme, ignores unknown ids, and lists labels left out', () => {
    const checked = checkMerge(labels, JSON.stringify({ themes: [
      { name: 'Exports are slow', labels: ['l1', 'l2', 'l9'] },
      { name: 'Again', labels: ['l2'] },
    ] }))!
    expect(checked.themes).toEqual([{ name: 'Exports are slow', ids: ['l1', 'l2'] }])
    expect(checked.missing).toEqual(['l3'])
  })

  it('replaces a theme name that holds a placeholder or is empty with its most frequent label', () => {
    const checked = checkMerge(labels, JSON.stringify({ themes: [
      { name: 'Ask [NAME_1] about exports', labels: ['l2', 'l1'] },
      { name: '  ', labels: ['l3'] },
    ] }))!
    expect(checked.themes.map(theme => theme.name)).toEqual(['Slow export', 'Login fails'])
    expect(checked.droppedNames).toBe(2)
  })

  it('rejects answers that are not the agreed shape', () => {
    expect(checkMerge(labels, 'nope')).toBeUndefined()
    expect(checkMerge(labels, '{"groups":[]}')).toBeUndefined()
  })
})

describe('runMerge', () => {
  const tagged = mapOf([
    text('t1', [tag('Slow export')], { jobs: [tag('Share reports')], gains: [tag('Faster export')] }),
    text('t2', [tag('Slow sync'), tag('Login fails')]),
  ])

  it('merges jobs, pains and gains with one request each, by label key', async () => {
    const kinds: string[] = []
    const result = await runMerge({ tagged, provider: 'anthropic', signal: never(), wait: noWait, send: async (content) => {
      kinds.push(JSON.parse(content).kind)
      return byFirstWord(content)
    } })
    expect(kinds).toEqual(['jobs', 'pains', 'gains'])
    expect(result.themes.pains).toEqual([
      { name: 'About slow', labels: ['slow export', 'slow sync'] },
      { name: 'About login', labels: ['login fails'] },
    ])
    expect(result.usage).toEqual({ input: 30, output: 15 })
    expect(result.stopped).toBeUndefined()
  })

  it('asks once more for labels left out, then makes each one a theme of its own', async () => {
    const sent: string[][] = []
    const result = await runMerge({ tagged, provider: 'anthropic', signal: never(), wait: noWait, send: async (content) => {
      const { labels } = JSON.parse(content) as { labels: MergeLabel[] }
      sent.push(labels.map(label => label.label))
      // Places only the first label each time.
      return body({ themes: [{ name: 'First', labels: [labels[0]!.id] }] })
    } })
    expect(sent.filter(labels => labels.includes('Slow sync') || labels.includes('Login fails')).length).toBe(2)
    expect(result.themes.pains!.flatMap(theme => theme.labels).sort()).toEqual(['login fails', 'slow export', 'slow sync'])
  })

  it('retries a broken answer once, then keeps every label as its own theme', async () => {
    let calls = 0
    const result = await runMerge({ tagged: mapOf([text('t1', [tag('Slow export'), tag('Login fails')])]), provider: 'anthropic', signal: never(), wait: noWait, send: async () => (calls++, body({ wrong: true })) })
    expect(calls).toBe(2)
    expect(result.themes.pains).toEqual([{ name: 'Slow export', labels: ['slow export'] }, { name: 'Login fails', labels: ['login fails'] }])
  })

  it('pauses on a problem no retry fixes, and a resumed merge sends only the kinds left', async () => {
    let fail = false
    const kinds: string[] = []
    const send = async (content: string): Promise<BatchReply> => {
      const kind = JSON.parse(content).kind
      if (kind === 'pains' && fail) return { ok: false, problem: 'invalidKey' }
      kinds.push(kind)
      return byFirstWord(content)
    }
    fail = true
    const first = await runMerge({ tagged, provider: 'anthropic', signal: never(), wait: noWait, send })
    expect(first.stopped).toBe('invalidKey')
    expect(first.themes.jobs).toBeDefined()
    expect(first.themes.pains).toBeUndefined()
    fail = false
    const second = await runMerge({ tagged, provider: 'anthropic', done: first.themes, signal: never(), wait: noWait, send })
    expect(second.stopped).toBeUndefined()
    expect(kinds).toEqual(['jobs', 'pains', 'gains'])
  })

  it('merges many labels in parts, then the parts\' themes once more, placing every label', async () => {
    const many = Array.from({ length: MERGE_CHUNK + 50 }, (_, index) => text(`t${index + 1}`, [tag(`${index % 2 ? 'Slow' : 'Broken'} thing ${index}`)]))
    const sizes: number[] = []
    const result = await runMerge({ tagged: mapOf(many), provider: 'anthropic', signal: never(), wait: noWait, send: async (content) => {
      const { kind, labels } = JSON.parse(content) as { kind: string, labels: MergeLabel[] }
      if (kind === 'pains') sizes.push(labels.length)
      return byFirstWord(content)
    } })
    // Two parts, then their four themes ("About slow", "About broken" in each) merged once more.
    expect(sizes).toEqual([MERGE_CHUNK, 50, 4])
    expect(result.themes.pains!.map(theme => theme.name)).toEqual(['About about'])
    expect(result.themes.pains![0]!.labels).toHaveLength(MERGE_CHUNK + 50)
  })

  it('stops when cancelled and keeps the kinds already merged', async () => {
    const controller = new AbortController()
    const result = await runMerge({ tagged, provider: 'anthropic', signal: controller.signal, wait: noWait, send: async (content) => {
      if (JSON.parse(content).kind === 'jobs') controller.abort()
      return byFirstWord(content)
    } })
    expect(result.stopped).toBe('cancelled')
    expect(result.themes.jobs).toBeDefined()
    expect(result.themes.gains).toBeUndefined()
  })
})

describe('countThemes', () => {
  const itemOf = new Map([['t1', 'cell:0:1:2'], ['t2', 'cell:0:2:2'], ['t3', 'cell:0:3:2'], ['t4', 'cell:0:4:2']])

  it('counts each item once per theme, with share, intensity from each item\'s strongest tag, and low confidence for few items', () => {
    const tagged = mapOf([
      text('t2', [tag('Slow export', 1), tag('Export hangs', 3)]),
      text('t1', [tag('Slow export', 2)]),
      text('t3', [tag('Login fails', 1)], { sentiment: 'mixed', type: 'bug' }),
      text('t4', []),
    ])
    const themes = countThemes(tagged, { pains: [{ name: 'Exports are slow', labels: ['slow export', 'export hangs'] }, { name: 'Cannot log in', labels: ['login fails'] }] }, itemOf)
    const [exports, login] = themes.pains
    expect(exports).toMatchObject({ name: 'Exports are slow', count: 2, share: 2 / 4, intensity: (3 + 2) / 2, confidence: 'low', items: ['cell:0:1:2', 'cell:0:2:2'] })
    expect(exports!.labels.sort()).toEqual(['Export hangs', 'Slow export'])
    expect(login).toMatchObject({ count: 1, sentiment: { mixed: 1, negative: 0 }, types: { bug: 1 } })
    expect(themes.jobs).toEqual([])
    expect(LOW_CONFIDENCE_BELOW).toBe(5)
  })

  it('counts every tag even when the merge left its label out, as a theme of its own', () => {
    const tagged = mapOf([text('t1', [tag('Slow export')]), text('t2', [tag('Login fails')])])
    const themes = countThemes(tagged, { pains: [{ name: 'Exports are slow', labels: ['slow export'] }] }, itemOf)
    expect(themes.pains.map(theme => [theme.name, theme.count])).toEqual([['Exports are slow', 1], ['Login fails', 1]])
  })

  it('takes no number from the AI: a count in the merge answer is ignored', () => {
    const tagged = mapOf([text('t1', [tag('Slow export')])])
    const checked = checkMerge([{ id: 'l1', label: 'Slow export', count: 1 }], JSON.stringify({ themes: [{ name: 'Exports', labels: ['l1'], count: 999, share: 0.9 }] }))!
    expect(checked.themes[0]).toEqual({ name: 'Exports', ids: ['l1'] })
    const themes = countThemes(tagged, { pains: [{ name: 'Exports', labels: ['slow export'], count: 999 } as never] }, itemOf)
    expect(themes.pains[0]).toMatchObject({ count: 1, share: 1 })
  })

  it('offers verified quotes only, one per item, strongest first, without repeats, linked to their items', () => {
    const tagged = mapOf([
      text('t1', [tag('Slow export', 1, 'a bit slow')]),
      text('t2', [tag('Slow export', 3, 'takes forever')]),
      text('t3', [tag('Slow export', 3, 'Takes forever')]),
      text('t4', [tag('Slow export', 2)]),
    ])
    const [theme] = countThemes(tagged, { pains: [{ name: 'Exports are slow', labels: ['slow export'] }] }, itemOf).pains
    expect(theme!.quotes).toEqual([
      { item: 'cell:0:2:2', quote: 'takes forever', intensity: 3 },
      { item: 'cell:0:1:2', quote: 'a bit slow', intensity: 1 },
    ])
  })

  it('ranks themes by items, then intensity, then name', () => {
    const tagged = mapOf([
      text('t1', [tag('B', 1), tag('A', 3), tag('C', 1)]),
      text('t2', [tag('C', 1)]),
    ])
    const themes = countThemes(tagged, {}, itemOf)
    expect(themes.pains.map(theme => theme.name)).toEqual(['C', 'A', 'B'])
  })
})
