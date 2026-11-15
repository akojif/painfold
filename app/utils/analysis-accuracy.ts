// What the Accuracy page and docs/accuracy.md publish from the analysis
// evaluation (#129): per language, the last test run that is fully scored
// (labels and a person's theme mapping), and the stability of two dev runs of
// the same model. Dev runs are for tuning and are never published on their
// own. Rates stay as counts, so both languages can be added up.
import type { Rate } from '../../scripts/analysis-metrics'
import type { AnalysisResults, RunResults } from '../../scripts/analysis-results'

export type AnalysisLang = 'en' | 'de'
export const ANALYSIS_LANGS: readonly AnalysisLang[] = ['en', 'de']

/** A test run with every score, the theme mapping included. */
export type PublishedRun = RunResults & { scores: Required<NonNullable<RunResults['scores']>> }

export type PublishedAnalysis = {
  runs: Partial<Record<AnalysisLang, PublishedRun>>
  /** Same answer when run twice: two dev runs of the published model, if there are two. */
  stability: Partial<Record<AnalysisLang, Rate>>
}

const isPublished = (run: RunResults): run is PublishedRun =>
  run.split === 'test' && run.notAnalyzed === 0 && run.merged && run.scores?.tags !== undefined && run.scores.mappedBy !== undefined

export function publishedAnalysis(results: AnalysisResults): PublishedAnalysis {
  const published: PublishedAnalysis = { runs: {}, stability: {} }
  for (const lang of ANALYSIS_LANGS) {
    // Runs are sorted by file name, which sorts by time within a language and model.
    const run = results.runs.filter(candidate => candidate.lang === lang && isPublished(candidate)).at(-1) as PublishedRun | undefined
    if (!run) continue
    published.runs[lang] = run
    const stable = results.stability.find(entry => entry.split === 'dev' && entry.lang === lang && entry.model === run.model)
    if (stable) published.stability[lang] = stable.presence
  }
  return published
}

/** Rates of several languages added up. */
export const addRates = (rates: readonly Rate[]): Rate => rates.reduce((total, rate) => ({ hits: total.hits + rate.hits, of: total.of + rate.of }), { hits: 0, of: 0 })
