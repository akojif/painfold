// The analysis evaluation's metrics (#129): how the jobs, pains and gains the
// AI finds compare with the gold labels people wrote (scripts/labels.ts).
// Everything here is plain counting, never asked of an AI; every rate keeps
// its numerator and denominator so the published numbers can show both.
//
// - presence: does an item have a job, a pain, a gain at all? Recall and precision.
// - grouping: pairwise. Two items that share a gold theme should share a model
//   theme, and the other way round. Needs no matching of wording.
// - tags: with a theme mapping made by a person (model theme to gold theme,
//   per language), which items carry which theme. Only for the final test run.
// - sentiment and type: accuracy, with a confusion table.
// - quotes: the share that passed the word-for-word check.
// - stability: two runs compared, on presence and grouping.
import { KINDS, type Kind } from '../core/ai/merge.ts'
import type { TaggedText } from '../core/ai/tagging.ts'
import type { Theme } from '../core/ai/themes.ts'
import type { FeedbackType, ItemLabels, Sentiment } from './labels.ts'

/** A share: hits of a total. Its value is undefined when there is nothing to count. */
export type Rate = { hits: number, of: number }
export const valueOf = (rate: Rate): number | undefined => (rate.of === 0 ? undefined : rate.hits / rate.of)

export type Scores = { recall: Rate, precision: Rate }

/** What the model said about one item: theme names per kind, sentiment and type. */
export type ItemPrediction = {
  id: string
  jobs: string[]
  pains: string[]
  gains: string[]
  sentiment: Sentiment
  type: FeedbackType
}

/** Something with an id and themes per kind: gold labels or a prediction. */
type Themed = Pick<ItemLabels, 'id' | Kind>

/**
 * The model's view of each item, from a run's tagged texts and its counted
 * themes (core/ai/themes.ts). Items are named by their id in the evaluation
 * set: `itemOf` maps the short ids sent (t1…) back to them.
 */
export function predictionsOf(tagged: ReadonlyMap<string, TaggedText>, themes: Record<Kind, readonly Theme[]>, itemOf: ReadonlyMap<string, string>): ItemPrediction[] {
  const byItem = new Map<string, ItemPrediction>()
  for (const text of tagged.values()) {
    const id = itemOf.get(text.id) ?? text.id
    byItem.set(id, { id, jobs: [], pains: [], gains: [], sentiment: text.sentiment, type: text.type })
  }
  for (const kind of KINDS) {
    for (const theme of themes[kind]) {
      for (const item of theme.items) byItem.get(item)?.[kind].push(theme.name)
    }
  }
  return [...byItem.values()]
}

/** Predictions lined up with the gold labels; an item the model did not analyze counts as saying nothing. */
function aligned(gold: readonly ItemLabels[], predicted: readonly ItemPrediction[]): Array<[ItemLabels, ItemPrediction | undefined]> {
  const byId = new Map(predicted.map(prediction => [prediction.id, prediction]))
  return gold.map(label => [label, byId.get(label.id)])
}

const scores = (hits: number, gold: number, predicted: number): Scores => ({ recall: { hits, of: gold }, precision: { hits, of: predicted } })

/** Per kind: does the item have one at all? */
export function presence(gold: readonly ItemLabels[], predicted: readonly ItemPrediction[]): Record<Kind, Scores> {
  const pairs = aligned(gold, predicted)
  return Object.fromEntries(KINDS.map((kind) => {
    const inGold = pairs.filter(([label]) => label[kind].length > 0)
    const inModel = pairs.filter(([, prediction]) => (prediction?.[kind].length ?? 0) > 0)
    const both = inGold.filter(([, prediction]) => (prediction?.[kind].length ?? 0) > 0)
    return [kind, scores(both.length, inGold.length, inModel.length)]
  })) as Record<Kind, Scores>
}

/** Every pair of items that share at least one theme of this kind, as "a|b" with a before b. */
export function sharedPairs(items: readonly Themed[], kind: Kind): Set<string> {
  const members = new Map<string, string[]>()
  for (const item of items) {
    for (const theme of new Set(item[kind])) members.set(theme, [...(members.get(theme) ?? []), item.id])
  }
  const pairs = new Set<string>()
  for (const ids of members.values()) {
    const sorted = [...new Set(ids)].sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) pairs.add(`${sorted[i]}|${sorted[j]}`)
    }
  }
  return pairs
}

/** Pairwise grouping per kind: `reference` is the truth (the gold labels, or the first run for stability). */
export function grouping(reference: readonly Themed[], compared: readonly Themed[]): Record<Kind, Scores> {
  const ids = new Set(reference.map(item => item.id))
  const inScope = compared.filter(item => ids.has(item.id))
  return Object.fromEntries(KINDS.map((kind) => {
    const truth = sharedPairs(reference, kind)
    const found = sharedPairs(inScope, kind)
    const both = [...found].filter(pair => truth.has(pair)).length
    return [kind, scores(both, truth.size, found.size)]
  })) as Record<Kind, Scores>
}

/** Model theme to gold theme, per kind, made by a person for one language; null: no gold theme fits. */
export type ThemeMapping = Record<Kind, Record<string, string | null>>

/**
 * Tag-level recall and precision with a theme mapping: a gold tag is an item
 * with a gold theme; a predicted tag is an item with a model theme. A model
 * theme the mapping leaves out, or maps to null, is a predicted tag that
 * matches nothing.
 */
export function tags(gold: readonly ItemLabels[], predicted: readonly ItemPrediction[], mapping: ThemeMapping): Record<Kind, Scores> {
  const pairs = aligned(gold, predicted)
  return Object.fromEntries(KINDS.map((kind) => {
    let truth = 0
    let found = 0
    let both = 0
    for (const [label, prediction] of pairs) {
      const goldThemes = new Set(label[kind])
      const modelThemes = [...new Set(prediction?.[kind] ?? [])]
      truth += goldThemes.size
      found += modelThemes.length
      const matched = new Set(modelThemes.map(theme => mapping[kind][theme]).filter((theme): theme is string => Boolean(theme) && goldThemes.has(theme!)))
      both += matched.size
    }
    return [kind, scores(both, truth, found)]
  })) as Record<Kind, Scores>
}

export type Accuracy<T extends string> = {
  correct: Rate
  /** Gold value, then the model's value: how often. */
  confusion: Record<T, Partial<Record<T, number>>>
}

/** Accuracy of a single-choice field (sentiment or type), with its confusion table. */
export function accuracy<F extends 'sentiment' | 'type'>(gold: readonly ItemLabels[], predicted: readonly ItemPrediction[], field: F): Accuracy<ItemLabels[F]> {
  const confusion = {} as Record<ItemLabels[F], Partial<Record<ItemLabels[F], number>>>
  let hits = 0
  let of = 0
  for (const [label, prediction] of aligned(gold, predicted)) {
    of++
    if (!prediction) continue
    const want = label[field]
    const got = prediction[field] as ItemLabels[F]
    confusion[want] ??= {}
    confusion[want][got] = (confusion[want][got] ?? 0) + 1
    if (want === got) hits++
  }
  return { correct: { hits, of }, confusion }
}

/** Quotes that passed the word-for-word check: kept ones of all given (kept and dropped). */
export function quoteRate(tagged: ReadonlyMap<string, TaggedText>, dropped: number): Rate {
  let kept = 0
  for (const text of tagged.values()) {
    for (const kind of KINDS) kept += text[kind].filter(tag => tag.quote).length
  }
  return { hits: kept, of: kept + dropped }
}

/** Two runs on the same items: how often they agree on presence, and how alike their grouping is. */
export function stability(first: readonly ItemPrediction[], second: readonly ItemPrediction[]): { presence: Rate, grouping: Record<Kind, Scores> } {
  const other = new Map(second.map(prediction => [prediction.id, prediction]))
  let hits = 0
  let of = 0
  for (const prediction of first) {
    for (const kind of KINDS) {
      of++
      const has = prediction[kind].length > 0
      const otherHas = (other.get(prediction.id)?.[kind].length ?? 0) > 0
      if (has === otherHas) hits++
    }
  }
  return { presence: { hits, of }, grouping: grouping(first, second) }
}
