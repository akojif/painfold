import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { addRates, publishedAnalysis } from '../../app/utils/analysis-accuracy'
import type { Scores } from '../../scripts/analysis-metrics'
import { ANALYSIS_DOCS_PATH, analysisMarkdown, withAnalysis } from '../../scripts/analysis-docs'
import { RESULTS_PATH, type AnalysisResults, type RunResults } from '../../scripts/analysis-results'

// What the Accuracy page and docs/accuracy.md publish from the analysis
// evaluation (#129). The results are invented.
const s = (hits: number, of: number, correct = hits, found = of): Scores => ({ recall: { hits, of }, precision: { hits: correct, of: found } })
const perKind = (scores: Scores) => ({ jobs: scores, pains: scores, gains: scores })
const run = (file: string, changes: Partial<RunResults> = {}, tags = true): RunResults => ({
  file,
  split: 'test',
  lang: 'en',
  model: 'claude-haiku-5-5',
  createdAt: '2026-11-20T10:00:00.000Z',
  commit: 'abc1234',
  texts: 60,
  notAnalyzed: 0,
  merged: true,
  themes: { jobs: 5, pains: 6, gains: 4 },
  quotes: { hits: 98, of: 100 },
  scores: {
    items: 60,
    presence: perKind(s(40, 50, 40, 45)),
    grouping: perKind(s(10, 20)),
    sentiment: { correct: { hits: 48, of: 60 }, confusion: { positive: { positive: 10, neutral: 2 }, negative: { negative: 38 }, neutral: { neutral: 0 } } as never },
    type: { correct: { hits: 42, of: 60 }, confusion: { bug: { bug: 42, question: 18 } } as never },
    ...(tags ? { tags: perKind(s(39, 50, 39, 46)), mappedBy: 'Francis Akoji' } : {}),
  },
  ...changes,
})
const results = (runs: RunResults[], stability: AnalysisResults['stability'] = []): AnalysisResults => ({ format: 'painfold-analysis-results/1', runs, stability })
const testPair = { split: 'test' as const, lang: 'en' as const, model: 'claude-haiku-5-5', files: ['test-a.json', 'test-b.json'] as [string, string], presence: { hits: 170, of: 180 }, grouping: perKind(s(1, 1)) }

describe('what is published', () => {
  it('nothing, until a test run is scored and its themes are mapped', () => {
    expect(publishedAnalysis(results([]))).toEqual({ runs: {}, stability: {} })
    expect(publishedAnalysis(results([run('dev-en.json', { split: 'dev' }), run('test-en.json', {}, false)])).runs).toEqual({})
  })

  it('never a test run that no longer fits the code', () => {
    expect(publishedAnalysis(results([run('a.json', { notAnalyzed: 2 }), run('b.json', { merged: false })])).runs).toEqual({})
  })

  it('the last fully scored test run per language, with two test runs of its model for stability', () => {
    const published = publishedAnalysis(results([run('test-en-1.json'), run('test-en-2.json'), run('test-de.json', { lang: 'de' })], [testPair, { ...testPair, model: 'other' }, { ...testPair, split: 'dev', presence: { hits: 1, of: 2 } }]))
    expect(published.runs.en?.file).toBe('test-en-2.json')
    expect(published.runs.de?.file).toBe('test-de.json')
    expect(published.stability).toEqual({ en: { hits: 170, of: 180 } })
  })

  it('adds both languages up as counts', () => {
    expect(addRates([{ hits: 39, of: 50 }, { hits: 30, of: 40 }])).toEqual({ hits: 69, of: 90 })
  })
})

describe('the section in docs/accuracy.md', () => {
  it('says it is not measured yet, and lists stored test runs only: dev runs stay off the public page', () => {
    const text = analysisMarkdown(results([run('dev-en.json', { split: 'dev' }, false), run('test-de.json', { split: 'test', lang: 'de' }, false)]))
    expect(text).toContain('Not measured yet.')
    expect(text).toContain('| `test-de.json` | 60 | 0 | yes | 0.98 (98/100) |')
    expect(text).not.toContain('dev-en.json')
    expect(analysisMarkdown(results([run('dev-en.json', { split: 'dev' }, false)]))).toContain('Stored test runs:\n\nNo runs stored yet.')
  })

  it('shows every score of a published run, with its confusion tables', () => {
    const text = analysisMarkdown(results([run('test-en.json')], [testPair]))
    expect(text).toContain('**English**: `test-en.json`, 60 texts, Claude Haiku 5.5, 2026-11-20, themes mapped by Francis Akoji.')
    expect(text).toContain('| Pains | 0.78 (39/50) | 0.85 (39/46) | 0.80 (40/50) | 0.89 (40/45) | 0.50 (10/20) | 0.50 (10/20) |')
    expect(text).toContain('| Same answer when run twice (test 1 and test 2) | 0.94 (170/180) |')
    expect(text).toContain('on its own it overstates how well Painfold names pains and gains')
    // Only values that occur get a row and a column.
    expect(text).toContain('| Sentiment | positive | negative | neutral |')
    expect(text).toContain('| positive | 10 | 0 | 2 |')
  })

  it('replaces only the text between its markers', () => {
    expect(withAnalysis('a\n<!-- analysis:start -->\nold\n<!-- analysis:end -->\nb', 'new')).toBe('a\n<!-- analysis:start -->\nnew\n<!-- analysis:end -->\nb')
    expect(() => withAnalysis('no markers', 'new')).toThrow(/needs/)
  })

  it('is up to date with the committed results: run npm run eval:analysis -- --write', () => {
    const doc = readFileSync(ANALYSIS_DOCS_PATH, 'utf8')
    const committed = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as AnalysisResults
    expect(doc).toBe(withAnalysis(doc, analysisMarkdown(committed)))
  })
})
