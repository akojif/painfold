// painfold.com/llms.txt (https://llmstxt.org): what Painfold is, its privacy
// model, its stages and its measured accuracy, for language models and the
// people using them. Built from the same sources as the site, so it cannot
// drift: the English interface text, the roadmap data, the accuracy results
// and docs/privacy.md. Written into the build by scripts/write-llms-txt.ts; a
// unit test checks every number and status against its source.
import { readFileSync } from 'node:fs'
import { addRates, publishedAnalysis } from '../app/utils/analysis-accuracy.ts'
import { COLUMNS, columnOf, releasesOf, ROADMAP_ITEMS, type ItemStatus } from '../app/utils/roadmap-items.ts'
import type { AnalysisResults } from './analysis-results.ts'
import type { Rate } from './analysis-metrics.ts'
import type { AccuracyData } from './eval.ts'

export const SITE = 'https://painfold.com'
export const REPO = 'https://github.com/akojif/painfold'

const STATUS: Record<ItemStatus, string> = { released: 'Released', inProgress: 'In progress', planned: 'Planned', idea: 'Idea' }

type Counts = { labelled: number, found: number }
const both = (byLang: Record<'de' | 'en', Counts>): Counts => ({ labelled: byLang.de.labelled + byLang.en.labelled, found: byLang.de.found + byLang.en.found })
const share = (counts: Counts) => (counts.labelled === 0 ? 0 : counts.found / counts.labelled)
const sum = (all: Counts[]) => all.reduce((total, counts) => ({ labelled: total.labelled + counts.labelled, found: total.found + counts.found }), { labelled: 0, found: 0 })
const percent = (value: number) => `${Math.round(value * 100)}%`
const rate = (value: Rate) => (value.of === 0 ? 0 : value.hits / value.of)

/** The headline name numbers, computed as the Accuracy page computes them. */
export function nameHeadline(data: AccuracyData) {
  const { names } = data
  return {
    removed: share(sum(names.groups.map(group => both(names.removal[group]!)))),
    weakest: Math.min(...names.groups.map(group => share(both(names.removal[group]!)))),
    groups: names.groups.length,
  }
}

/** The headline analysis numbers of the published test runs, both languages together, as on the Accuracy page. */
export function analysisHeadline(results: AnalysisResults) {
  const runs = Object.values(publishedAnalysis(results).runs)
  if (runs.length === 0) return undefined
  const found = (kind: 'jobs' | 'pains' | 'gains') => rate(addRates(runs.map(run => run.scores.tags[kind].recall)))
  const correct = (kind: 'jobs' | 'pains' | 'gains') => rate(addRates(runs.map(run => run.scores.tags[kind].precision)))
  return {
    texts: Math.min(...runs.map(run => run.texts)),
    jobs: { found: found('jobs'), correct: correct('jobs') },
    pains: { found: found('pains'), correct: correct('pains') },
    gains: { found: found('gains'), correct: correct('gains') },
    quotes: rate(addRates(runs.map(run => run.quotes))),
  }
}

/** A section of docs/privacy.md, word for word, with its relative links made absolute. */
export function privacySection(doc: string, heading: string): string {
  const start = doc.indexOf(`## ${heading}\n`)
  if (start === -1) throw new Error(`docs/privacy.md needs a "## ${heading}" section`)
  const end = doc.indexOf('\n## ', start + 1)
  const body = doc.slice(start + heading.length + 4, end === -1 ? undefined : end).trim()
  return body.replace(/\]\((?!https?:)([^)]+)\)/g, (_, path: string) => `](${REPO}/blob/main/docs/${path})`)
}

export type LlmsSources = {
  version: string
  /** The English roadmap item names and summaries (roadmap.items in i18n/locales/en/roadmap.json). */
  items: Record<string, { name: string, summary: string }>
  accuracy: AccuracyData
  analysis: AnalysisResults
  privacyDoc: string
}

/** Reads every source from the repository. */
export function readSources(root = '.'): LlmsSources {
  const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8')
  return {
    version: (JSON.parse(read('package.json')) as { version: string }).version,
    items: (JSON.parse(read('i18n/locales/en/roadmap.json')) as { roadmap: { items: LlmsSources['items'] } }).roadmap.items,
    accuracy: JSON.parse(read('data/eval/accuracy.json')) as AccuracyData,
    analysis: JSON.parse(read('data/eval/analysis/results.json')) as AnalysisResults,
    privacyDoc: read('docs/privacy.md'),
  }
}

export function llmsTxt(sources: LlmsSources): string {
  const { items, version } = sources
  const names = nameHeadline(sources.accuracy)
  const analysis = analysisHeadline(sources.analysis)
  const releases = releasesOf(ROADMAP_ITEMS)
  const line = (id: string) => `${items[id]?.name ?? id}: ${items[id]?.summary ?? ''}`
  const roadmapLines = [
    ...releases.map(item => `- ${item.version}, ${STATUS[item.status]} ${item.released}: ${line(item.id)} ${item.link.url}`),
    ...COLUMNS.flatMap(column => columnOf(ROADMAP_ITEMS, column)).map(item => `- ${item.version ? `${item.version}, ` : ''}${STATUS[item.status]}: ${line(item.id)} ${item.link.url}`),
  ]

  return `# Painfold

> Painfold removes personal data from customer feedback (CSV or Excel files, in German and English) in the person's own browser, then, if they choose, finds what their customers are trying to get done, what frustrates them and what they wish for: jobs, pains and gains, as in the Value Proposition Canvas. The analysis uses an AI the person chooses: their own Anthropic API key, sent straight from the browser, or a local model with Ollama. Painfold has no server that receives files. It is open source under the MIT licence.

Current version: ${version}. English and German interface. Website: ${SITE}/

## What it does

- Opens a CSV or Excel file in the browser and lets the person choose which columns are checked, kept as they are or left out.
- Finds personal data with rules (email addresses, phone numbers, IBANs, card numbers, social security numbers, VAT IDs, links, IP addresses, dates of birth, street addresses, postcodes) and, with an optional name model downloaded to the browser, names and places. It warns about text that could identify someone together with other details.
- The person reviews every finding, by value or by row, and downloads the cleaned file with a cleaning report.
- Optionally, it sends only the cleaned text to the chosen AI and shows a report of jobs, pains and gains. Every count is computed in code, and every quote is checked word for word against the cleaned text.

## Privacy

${privacySection(sources.privacyDoc, 'Privacy')}

### What is stored in the browser

${privacySection(sources.privacyDoc, 'What is stored in your browser')}

## What Painfold does not do

- It does not process files on a server: there is no server that receives them, and no server-side processing of any kind.
- It has no accounts, no sign-in, no cookies, no analytics and no tracking.
- It does not send anything to an AI until the person has reviewed what was removed, seen what will be sent and pressed Send.
- On a phone the site only explains what Painfold does; working on a file needs a screen at least 768 pixels wide.

### What Painfold doesn't protect against

${privacySection(sources.privacyDoc, "What Painfold doesn't protect against")}

## Accuracy

Measured on small evaluation sets of invented German and English feedback; read the numbers with their known weaknesses.

- Names: ${percent(names.removed)} of test names are removed, and at least ${percent(names.weakest)} in every one of ${names.groups} name-origin groups.
${analysis
  ? `- Jobs, pains and gains, under the right theme, on ${analysis.texts} hand-labelled test texts per language: ${percent(analysis.jobs.found)} of jobs, ${percent(analysis.pains.found)} of pains and ${percent(analysis.gains.found)} of gains are found; of what is reported, ${percent(analysis.jobs.correct)}, ${percent(analysis.pains.correct)} and ${percent(analysis.gains.correct)} match the labels. ${percent(analysis.quotes)} of quotes were found word for word.`
  : '- Jobs, pains and gains: not measured yet.'}
- Numbers, method and known weaknesses: ${SITE}/accuracy/ (German: ${SITE}/de/accuracy/) and ${REPO}/blob/main/docs/accuracy.md

## Roadmap

${roadmapLines.join('\n')}

Roadmap page: ${SITE}/roadmap/ (German: ${SITE}/de/roadmap/)

## Links

- [Start page](${SITE}/): open a file or try the sample. German: ${SITE}/de/
- [How it works](${REPO}/blob/main/docs/how-it-works.md): what Painfold does, step by step
- [Privacy](${REPO}/blob/main/docs/privacy.md): what stays in the browser, what is stored and what is downloaded, the data flow, the tests behind each claim ("How we prove it") and what Painfold doesn't protect against
- [Security](${REPO}/blob/main/SECURITY.md): how to report a privacy leak or security problem privately
- [Feedback](${REPO}/blob/main/docs/feedback.md): no analytics or tracking, what the host sees, and where to ask questions and share ideas (${REPO}/discussions)
- [Accuracy](${SITE}/accuracy/): measured accuracy and known weaknesses. German: ${SITE}/de/accuracy/
- [Roadmap](${SITE}/roadmap/): released versions and what comes next. German: ${SITE}/de/roadmap/
- [Source code](${REPO}): the GitHub repository
- [Changelog](${REPO}/blob/main/CHANGELOG.md): what changed in each version
- [Licence](${REPO}/blob/main/LICENSE): MIT
`
}
