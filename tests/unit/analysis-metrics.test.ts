import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Kind } from '../../core/ai/merge'
import type { Tag, TaggedText } from '../../core/ai/tagging'
import { countThemes } from '../../core/ai/themes'
import { accuracy, grouping, predictionsOf, presence, quoteRate, sharedPairs, stability, tags, valueOf, type ItemPrediction, type ThemeMapping } from '../../scripts/analysis-metrics'
import type { ItemLabels } from '../../scripts/labels'

// The analysis metrics (#129), on six invented items (tests/fixtures/analysis-eval/).
// Every expected number is worked out by hand from the fixture; the comments show how.
const gold = readFileSync('tests/fixtures/analysis-eval/labels-en.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line) as ItemLabels)

const predict = (id: string, jobs: string[], pains: string[], gains: string[], sentiment: ItemPrediction['sentiment'], type: ItemPrediction['type']): ItemPrediction =>
  ({ id: `en-90${id}`, jobs, pains, gains, sentiment, type })
// What a run might say: other wording, one pain too many (2), one gain missed (6),
// payroll grouped with the bank feed (5), one sentiment (2) and one type (5) wrong.
const predicted: ItemPrediction[] = [
  predict('1', ['Invoicing'], ['Bank connection'], [], 'negative', 'bug'),
  predict('2', ['Invoicing'], ['Late payments'], ['Reminder schedule'], 'positive', 'feature request'),
  predict('3', [], ['Bank connection'], [], 'negative', 'bug'),
  predict('4', [], [], [], 'positive', 'praise'),
  predict('5', ['Payroll'], ['Bank connection'], [], 'negative', 'bug'),
  predict('6', [], [], [], 'neutral', 'question'),
]

describe('the fixture', () => {
  it('is in the converter\'s format: six labelled dev items', () => {
    expect(gold).toHaveLength(6)
    for (const label of gold) expect(Object.keys(label)).toEqual(expect.arrayContaining(['id', 'lang', 'split', 'jobs', 'pains', 'gains', 'sentiment', 'type']))
  })
})

describe('presence', () => {
  it('counts items that have a job, a pain or a gain at all', () => {
    expect(presence(gold, predicted)).toEqual({
      // Gold 1, 2, 5; model 1, 2, 5.
      jobs: { recall: { hits: 3, of: 3 }, precision: { hits: 3, of: 3 } },
      // Gold 1, 3, 5; model 1, 2, 3, 5: one too many.
      pains: { recall: { hits: 3, of: 3 }, precision: { hits: 3, of: 4 } },
      // Gold 2, 6; model 2: one missed.
      gains: { recall: { hits: 1, of: 2 }, precision: { hits: 1, of: 1 } },
    })
  })

  it('counts an item the model did not analyze as saying nothing', () => {
    expect(presence(gold, predicted.filter(prediction => prediction.id !== 'en-901')).jobs.recall).toEqual({ hits: 2, of: 3 })
  })
})

describe('grouping', () => {
  it('lists the pairs of items that share a theme', () => {
    expect([...sharedPairs(gold, 'pains')]).toEqual(['en-901|en-903'])
    expect([...sharedPairs(predicted, 'pains')].sort()).toEqual(['en-901|en-903', 'en-901|en-905', 'en-903|en-905'])
  })

  it('compares pairs, not wording', () => {
    expect(grouping(gold, predicted)).toEqual({
      // Gold: 1 and 2 share a job; model: 1 and 2 share one too.
      jobs: { recall: { hits: 1, of: 1 }, precision: { hits: 1, of: 1 } },
      // Gold: only 1 and 3; model: 1, 3 and 5 all together, so two wrong pairs.
      pains: { recall: { hits: 1, of: 1 }, precision: { hits: 1, of: 3 } },
      // Gold: 2 and 6 share a gain; the model found it only in 2.
      gains: { recall: { hits: 0, of: 1 }, precision: { hits: 0, of: 0 } },
    })
  })

  it('has no value where there is nothing to count', () => {
    expect(valueOf({ hits: 0, of: 0 })).toBeUndefined()
    expect(valueOf({ hits: 1, of: 3 })).toBeCloseTo(1 / 3)
  })
})

describe('tags, with a theme mapping made by a person', () => {
  const mapping: ThemeMapping = {
    jobs: { Invoicing: 'Send invoices', Payroll: 'Pay staff' },
    pains: { 'Bank connection': 'Bank feed drops', 'Late payments': null },
    gains: { 'Reminder schedule': 'Custom reminders' },
  }

  it('counts which items carry which gold theme', () => {
    expect(tags(gold, predicted, mapping)).toEqual({
      // Every job tag maps onto its gold tag.
      jobs: { recall: { hits: 3, of: 3 }, precision: { hits: 3, of: 3 } },
      // Gold: bank feed in 1 and 3, slow payroll in 5. Model: bank connection in 1, 3, 5 and an unmapped theme in 2.
      pains: { recall: { hits: 2, of: 3 }, precision: { hits: 2, of: 4 } },
      // Gold: custom reminders in 2 and 6; the model has it in 2.
      gains: { recall: { hits: 1, of: 2 }, precision: { hits: 1, of: 1 } },
    })
  })

  it('treats a model theme the mapping leaves out as matching nothing', () => {
    const partial: ThemeMapping = { ...mapping, jobs: { Invoicing: 'Send invoices' } }
    expect(tags(gold, predicted, partial).jobs).toEqual({ recall: { hits: 2, of: 3 }, precision: { hits: 2, of: 3 } })
  })
})

describe('sentiment and type', () => {
  it('scores each with a confusion table', () => {
    const sentiment = accuracy(gold, predicted, 'sentiment')
    expect(sentiment.correct).toEqual({ hits: 5, of: 6 })
    expect(sentiment.confusion.mixed).toEqual({ positive: 1 })
    const type = accuracy(gold, predicted, 'type')
    expect(type.correct).toEqual({ hits: 5, of: 6 })
    expect(type.confusion.complaint).toEqual({ bug: 1 })
    expect(type.confusion.bug).toEqual({ bug: 2 })
  })
})

describe('stability', () => {
  it('compares two runs on presence and grouping', () => {
    // The second run misses the pain in 2: one of 18 item-and-kind cells differs.
    const second = predicted.map(prediction => (prediction.id === 'en-902' ? { ...prediction, pains: [] } : prediction))
    const result = stability(predicted, second)
    expect(result.presence).toEqual({ hits: 17, of: 18 })
    expect(result.grouping.pains).toEqual({ recall: { hits: 3, of: 3 }, precision: { hits: 3, of: 3 } })
  })
})

describe('from a run', () => {
  const tag = (label: string, quote?: string): Tag => ({ label, intensity: 2, ...(quote ? { quote } : {}) })
  const text = (id: string, pains: Tag[], extra: Partial<TaggedText> = {}): TaggedText => ({ id, jobs: [], pains, gains: [], sentiment: 'negative', type: 'bug', ...extra })
  const tagged = new Map([
    ['t1', text('t1', [tag('Bank connection drops', 'the bank feed disconnected')])],
    ['t2', text('t2', [tag('bank connection drops')], { sentiment: 'neutral', type: 'question' })],
    ['t3', text('t3', [])],
  ])
  const itemOf = new Map([['t1', 'en-901'], ['t2', 'en-903'], ['t3', 'en-904']])
  const merged: Partial<Record<Kind, Array<{ name: string, labels: string[] }>>> = { pains: [{ name: 'Bank connection', labels: ['bank connection drops'] }] }

  it('turns tagged texts and counted themes into predictions by item id', () => {
    const predictions = predictionsOf(tagged, countThemes(tagged, merged, itemOf), itemOf)
    expect(predictions).toEqual([
      { id: 'en-901', jobs: [], pains: ['Bank connection'], gains: [], sentiment: 'negative', type: 'bug' },
      { id: 'en-903', jobs: [], pains: ['Bank connection'], gains: [], sentiment: 'neutral', type: 'question' },
      { id: 'en-904', jobs: [], pains: [], gains: [], sentiment: 'negative', type: 'bug' },
    ])
  })

  it('counts the quotes kept against all quotes given', () => {
    // One kept, and the run reports two dropped.
    expect(quoteRate(tagged, 2)).toEqual({ hits: 1, of: 3 })
  })
})
