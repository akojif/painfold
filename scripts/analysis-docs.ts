// The analysis evaluation's section of docs/accuracy.md (#129), written by
// `npm run eval:analysis -- --write` between its markers, from the same
// results as the Accuracy page: the published test runs in full (grouping and
// the confusion tables included), and the stored test runs. Dev runs used for
// tuning stay out of the public page; they are in data/eval/analysis/runs-log.md
// and results.json. A unit test fails when the section is out of date.
import { publishedAnalysis, type PublishedRun } from '../app/utils/analysis-accuracy.ts'
import { ANTHROPIC_MODELS } from '../core/ai/providers.ts'
import { KINDS } from '../core/ai/merge.ts'
import type { Accuracy, Rate, Scores } from './analysis-metrics.ts'
import type { AnalysisResults } from './analysis-results.ts'
import { SENTIMENTS, TYPES } from './labels.ts'

export const ANALYSIS_DOCS_PATH = 'docs/accuracy.md'
const START = '<!-- analysis:start -->'
const END = '<!-- analysis:end -->'

const LANGUAGE = { en: 'English', de: 'German' } as const
const TAGS_FIRST = 'Tag recall and precision count a job, pain or gain only when Painfold put it under the theme a person matched to the label. Presence only checks that a text has a job, pain or gain of that kind at all, so it is higher, and on its own it overstates how well Painfold names pains and gains.'
const KIND = { jobs: 'Jobs', pains: 'Pains', gains: 'Gains' } as const

/** A rate as "0.78 (39/50)", or "n/a" when nothing was counted. */
const rate = (value: Rate) => (value.of === 0 ? 'n/a' : `${(value.hits / value.of).toFixed(2)} (${value.hits}/${value.of})`)
const modelName = (id: string) => ANTHROPIC_MODELS.find(model => model.id === id)?.name ?? id
const table = (head: readonly string[], rows: ReadonlyArray<readonly string[]>, right = 1) =>
  [head, head.map((_, index) => (index < right ? '---' : '---:')), ...rows].map(row => `| ${row.join(' | ')} |`).join('\n')
const pair = (scores: Scores) => [rate(scores.recall), rate(scores.precision)]

function confusion<T extends string>(name: string, values: readonly T[], result: Accuracy<T>): string {
  const used = values.filter(value => result.confusion[value] !== undefined || values.some(want => result.confusion[want]?.[value] !== undefined))
  return `${name}, labelled (rows) against Painfold's answer (columns):\n\n${table([name, ...used], used.map(want => [want, ...used.map(got => String(result.confusion[want]?.[got] ?? 0))]))}`
}

function runSection(run: PublishedRun, stability: Rate | undefined): string {
  const { scores } = run
  return [
    `**${LANGUAGE[run.lang]}**: \`${run.file}\`, ${run.texts} texts, ${modelName(run.model)}, ${run.createdAt.slice(0, 10)}, themes mapped by ${scores.mappedBy}.`,
    table(['Kind', 'Tag recall', 'Tag precision', 'Presence recall', 'Presence precision', 'Grouping recall', 'Grouping precision'],
      KINDS.map(kind => [KIND[kind], ...pair(scores.tags[kind]), ...pair(scores.presence[kind]), ...pair(scores.grouping[kind])])),
    table(['Measure', 'Value'], [
      ['Sentiment correct', rate(scores.sentiment.correct)],
      ['Type correct', rate(scores.type.correct)],
      ['Quotes found word for word', rate(run.quotes)],
      ['Same answer when run twice (test 1 and test 2)', stability ? rate(stability) : 'n/a'],
    ]),
    confusion('Sentiment', SENTIMENTS, scores.sentiment),
    confusion('Type', TYPES, scores.type),
  ].join('\n\n')
}

/** The section's text, from the results. */
export function analysisMarkdown(results: AnalysisResults): string {
  const published = publishedAnalysis(results)
  const runs = (['en', 'de'] as const).flatMap(lang => published.runs[lang] ?? [])
  const sections = runs.length === 0
    ? ['Not measured yet. The numbers appear here before version 0.3.0 is released.']
    : [TAGS_FIRST, ...runs.map(run => runSection(run, published.stability[run.lang]))]
  const testRuns = results.runs.filter(run => run.split === 'test')
  const stored = testRuns.length === 0
    ? 'No runs stored yet.'
    : table(['Run', 'Texts', 'Not analyzed', 'Merged', 'Quotes kept'], testRuns.map(run => [`\`${run.file}\``, String(run.texts), String(run.notAnalyzed), run.merged ? 'yes' : 'no', rate(run.quotes)]))
  return [...sections, `Stored test runs:\n\n${stored}`].join('\n\n')
}

/** The document with the text between the markers replaced. */
export function withAnalysis(doc: string, markdown: string): string {
  const start = doc.indexOf(START)
  const end = doc.indexOf(END)
  if (start === -1 || end < start) throw new Error(`${ANALYSIS_DOCS_PATH} needs ${START} and ${END}`)
  return `${doc.slice(0, start + START.length)}\n${markdown}\n${doc.slice(end)}`
}
