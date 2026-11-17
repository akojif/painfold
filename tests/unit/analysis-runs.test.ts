import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BatchReply } from '../../core/ai/run'
import { presence, tags, type ThemeMapping } from '../../scripts/analysis-metrics'
import { computeResults, RESULTS_PATH, resultsJson, type AnalysisResults } from '../../scripts/analysis-results'
import { recordRun, replayEvalRun, runFileName, RUNS_DIR, type EvalRun, type Senders } from '../../scripts/analysis-runs'
import { runsLog } from '../../scripts/runs-log-file'
import { numberedRuns, promptHash, RUNS_LOG_PATH, runsLogBlocks, withRunsLogBlocks } from '../../scripts/runs-log'
import type { ItemLabels, LabelItem } from '../../scripts/labels'
import { MAPPINGS_DIR, type StoredMapping } from '../../scripts/theme-mapping'

// Stored runs of the analysis evaluation (#129): recorded with invented
// answers, replayed through the live code, and scored. The last test checks
// that the committed results match the stored runs and labels.
const gold = readFileSync('tests/fixtures/analysis-eval/labels-en.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line) as ItemLabels)

// The six fixture items, with invented texts.
const items: LabelItem[] = [
  { id: 'en-901', lang: 'en', split: 'dev', text: 'I send invoices every week, but the bank feed keeps dropping.' },
  { id: 'en-902', lang: 'en', split: 'dev', text: 'Invoicing is fine. I would love to set my own reminder schedule.' },
  { id: 'en-903', lang: 'en', split: 'dev', text: 'The bank feed disconnected again this morning.' },
  { id: 'en-904', lang: 'en', split: 'dev', text: 'Thank you, everything works.' },
  { id: 'en-905', lang: 'en', split: 'dev', text: 'Paying staff takes forever because payroll is so slow.' },
  { id: 'en-906', lang: 'en', split: 'dev', text: 'Can I change when reminders go out?' },
  { id: 'en-907', lang: 'en', split: 'test', text: 'A test item, never sent with the dev split.' },
]

const answer = (json: unknown): BatchReply => ({ ok: true, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'not stored' }, { type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 100, output_tokens: 20 } }) })

/** Invented answers: labels from words in the text, quoting its first four words; the merge keeps every label as its own theme. */
const senders = (variant = 0): Senders => ({
  tag: async (_payload, batch) => answer({
    texts: batch.map(({ id, text }) => {
      const tag = (label: string) => ({ label, intensity: 2, quote: text.split(' ').slice(0, 4).join(' ') })
      return {
        id,
        jobs: /invoic/i.test(text) ? [tag('Send invoices')] : /staff/i.test(text) ? [tag('Pay staff')] : [],
        pains: /bank feed/i.test(text) ? [tag('Bank feed drops')] : /slow/i.test(text) && variant === 0 ? [tag('Slow payroll')] : [],
        gains: /reminder/i.test(text) ? [tag('Custom reminders')] : [],
        sentiment: /thank/i.test(text) ? 'positive' : /\?/.test(text) ? 'neutral' : 'negative',
        type: /thank/i.test(text) ? 'praise' : /\?/.test(text) ? 'question' : 'bug',
      }
    }),
  }),
  merge: async (_system, asked) => {
    const { labels } = JSON.parse(asked) as { labels: Array<{ id: string, label: string }> }
    return answer({ themes: labels.map(label => ({ name: label.label, labels: [label.id] })) })
  },
})

const meta = { createdAt: '2026-11-15T10:00:00.000Z', painfoldVersion: '0.2.0', commit: 'abc1234' }
const record = (variant = 0) => recordRun({ items, split: 'dev', lang: 'en', model: 'claude-haiku-5-5', send: senders(variant), meta })

describe('recording a run', () => {
  it('sends only the chosen split and language, and keeps the answers without the thinking', async () => {
    const run = await record()
    expect(run.payload.texts.map(text => text.text)).not.toContain('A test item, never sent with the dev split.')
    expect(run.itemOf.map(([, item]) => item)).toEqual(['en-901', 'en-902', 'en-903', 'en-904', 'en-905', 'en-906'])
    expect(JSON.stringify(run)).not.toContain('not stored')
    expect(run.usage).toEqual({ input: 100 * (run.tagging.length + run.merge.length), output: 20 * (run.tagging.length + run.merge.length) })
    expect(run.settings).toMatchObject({ batchSize: 25 })
  })

  it('stops with an error rather than store a partial run', async () => {
    const failing: Senders = { ...senders(), tag: async () => ({ ok: false, problem: 'invalidKey' }) }
    await expect(recordRun({ items, split: 'dev', lang: 'en', model: 'claude-haiku-5-5', send: failing, meta })).rejects.toThrow(/nothing was written/)
  })

  it('names files so they sort by split, language, model and time', async () => {
    expect(runFileName(await record())).toBe('dev-en-claude-haiku-5-5-2026-11-15T10-00-00Z.json')
  })
})

describe('replaying and scoring', () => {
  it('replays a stored run through the live code, without a request, into predictions by item id', async () => {
    const replayed = await replayEvalRun(await record())
    expect(replayed.notAnalyzed).toBe(0)
    expect(replayed.merged).toBe(true)
    expect(replayed.predictions.find(prediction => prediction.id === 'en-905')).toMatchObject({ jobs: ['Pay staff'], pains: ['Slow payroll'] })
    // Every quote is the text's first four words, so all pass the word-for-word check.
    expect(replayed.quotes.hits).toBe(replayed.quotes.of)
  })

  it('scores each run against the labels of its language and split, and two runs for stability', async () => {
    const first = await record()
    const second = await record(1)
    const results = await computeResults([{ file: 'b.json', run: second }, { file: 'a.json', run: first }], gold)
    expect(results.runs.map(run => run.file)).toEqual(['a.json', 'b.json'])
    const replayed = await replayEvalRun(first)
    expect(results.runs[0]!.scores!.presence).toEqual(presence(gold, replayed.predictions))
    // The invented answers miss only the mixed sentiment (en-902).
    expect(results.runs[0]!.scores!.sentiment.correct).toEqual({ hits: 5, of: 6 })
    // The second run misses the payroll pain: one of 18 cells differs.
    expect(results.stability).toEqual([expect.objectContaining({ files: ['a.json', 'b.json'], presence: { hits: 17, of: 18 } })])
  })

  it('adds tag-level scores, and who mapped, once a person has mapped the run\'s themes', async () => {
    const run = await record()
    // The invented answers use the gold wording, so the person maps each theme onto itself.
    const mapping: ThemeMapping = {
      jobs: { 'Send invoices': 'Send invoices', 'Pay staff': 'Pay staff' },
      pains: { 'Bank feed drops': 'Bank feed drops', 'Slow payroll': 'Slow payroll' },
      gains: { 'Custom reminders': 'Custom reminders' },
    }
    const stored: StoredMapping = { format: 'painfold-theme-mapping/1', run: 'a.json', lang: 'en', mappedBy: 'Francis Akoji', mapping }
    const results = await computeResults([{ file: 'a.json', run }], gold, [stored])
    const replayed = await replayEvalRun(run)
    expect(results.runs[0]!.scores!.mappedBy).toBe('Francis Akoji')
    expect(results.runs[0]!.scores!.tags).toEqual(tags(gold, replayed.predictions, mapping))
    expect(results.runs[0]!.scores!.tags!.pains).toEqual({ recall: { hits: 3, of: 3 }, precision: { hits: 3, of: 3 } })
    // Without a mapping for that run, no tag-level scores.
    expect((await computeResults([{ file: 'b.json', run }], gold, [stored])).runs[0]!.scores!.tags).toBeUndefined()
  })

  it('leaves the scores out until labels for the language exist', async () => {
    const results = await computeResults([{ file: 'a.json', run: await record() }], [])
    expect(results.runs[0]!.scores).toBeUndefined()
  })

  it('notices when a stored run no longer fits the code', async () => {
    const run = await record()
    const changed: EvalRun = { ...run, payload: { ...run.payload, texts: run.payload.texts.map(text => ({ ...text, text: `${text.text} ` })) } }
    expect((await replayEvalRun(changed)).notAnalyzed).toBe(6)
  })
})

describe('the committed results', () => {
  it('match the stored runs and labels: run npm run eval:analysis -- --write after any change', async () => {
    const runs = existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).filter(file => file.endsWith('.json')).sort().map(file => ({ file, run: JSON.parse(readFileSync(`${RUNS_DIR}/${file}`, 'utf8')) as EvalRun })) : []
    const labels = ['en', 'de'].map(lang => `data/eval/analysis/labels-${lang}.jsonl`).filter(path => existsSync(path))
      .flatMap(path => readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as ItemLabels))
    const mappings = existsSync(MAPPINGS_DIR) ? readdirSync(MAPPINGS_DIR).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(`${MAPPINGS_DIR}/${file}`, 'utf8')) as StoredMapping) : []
    expect(readFileSync(RESULTS_PATH, 'utf8')).toBe(resultsJson(await computeResults(runs, labels, mappings)))
  })

  it('match the run log\'s generated tables: run npm run eval:analysis -- --write after any change', async () => {
    const runs = existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).filter(file => file.endsWith('.json')).sort().map(file => ({ file, run: JSON.parse(readFileSync(`${RUNS_DIR}/${file}`, 'utf8')) as EvalRun })) : []
    const committed = readFileSync(RUNS_LOG_PATH, 'utf8')
    const results = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as AnalysisResults
    expect(committed).toBe(await runsLog(committed, runs, results))
  })
})

describe('the run log', () => {
  it('numbers runs per split and language in the order they were made, and says where each label gap was seen', async () => {
    const run = await record()
    const at = (createdAt: string, lang: 'en' | 'de' = 'en') => ({ ...run, createdAt, lang })
    const runs = [
      { file: 'b.json', run: at('2026-11-17T10:05:00Z') },
      { file: 'a.json', run: at('2026-11-17T10:00:00Z') },
      { file: 'c.json', run: { ...at('2026-11-17T10:02:00Z', 'de'), durationMs: 61_400 } },
    ]
    expect(numberedRuns(runs).map(({ file, label }) => `${file} ${label}`)).toEqual(['a.json dev 1', 'c.json dev 1', 'b.json dev 2'])
    const predictions = new Map([['a.json', [{ id: 'en-001', jobs: [], pains: ['Bank feed drops'], gains: [], sentiment: 'negative' as const, type: 'bug' as const }]], ['b.json', []]])
    const blocks = runsLogBlocks(runs, await computeResults(runs, gold), predictions, [{ id: 'en-001', kind: 'pains', found: 'bank feed', why: 'Invented.' }, { id: 'en-002', kind: 'gains', found: 'x', why: 'Invented.' }])
    expect(blocks.gaps).toContain('| en-001 | pain: bank feed | run 1 | Invented. |')
    expect(blocks.gaps).toContain('| en-002 | gain: x | none | Invented. |')
    expect(blocks.runs).toContain('| 61 s |')
    expect(blocks.runs).toContain('not recorded')
    expect(blocks.runs).toContain(`\`${promptHash(run.payload)}\``)
    expect(() => withRunsLogBlocks('no markers', blocks)).toThrow(/needs <!-- generated:runs:start -->/)
  })
})
