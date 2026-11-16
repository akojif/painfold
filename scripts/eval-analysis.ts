// The analysis evaluation (#129): stored runs, replayed and scored against the
// gold labels. See scripts/analysis-runs.ts, analysis-results.ts and
// analysis-metrics.ts.
//
//   npm run eval:analysis                       replay every stored run and print the numbers
//   npm run eval:analysis -- --write            also write data/eval/analysis/results.json and the section in docs/accuracy.md
//   ANTHROPIC_API_KEY=... npm run eval:analysis -- --run --split dev [--lang en|de] [--model claude-haiku-5-5]
//                                               record a new run (both languages unless --lang), then write
//
// Tune on the dev split only. The test split is run once, after tuning, and
// that run is what is published: --run --split test refuses when a test run
// for that language and model is already stored, unless --again is given.
// A dev run of 60 texts per language costs about one US cent with Claude
// Haiku 5.5. The key is only read from the environment, never printed or stored.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { PRICES } from '../core/ai/cost.ts'
import { KINDS } from '../core/ai/merge.ts'
import { anthropicJsonRequest, anthropicTaggingRequest } from '../core/ai/tagging.ts'
import { valueOf, type Rate, type Scores } from './analysis-metrics.ts'
import { ANALYSIS_DOCS_PATH, analysisMarkdown, withAnalysis } from './analysis-docs.ts'
import { computeResults, RESULTS_PATH, resultsJson } from './analysis-results.ts'
import { recordRun, runFileName, RUNS_DIR, type EvalRun } from './analysis-runs.ts'
import { post } from './ai-post.ts'
import type { ItemLabels, LabelItem } from './labels.ts'
import { MAPPINGS_DIR, type StoredMapping } from './theme-mapping.ts'

const ITEMS_PATH = 'data/eval/analysis/items.jsonl'
const LABEL_PATHS = { en: 'data/eval/analysis/labels-en.jsonl', de: 'data/eval/analysis/labels-de.jsonl' }

const { values } = parseArgs({
  options: {
    write: { type: 'boolean', default: false },
    run: { type: 'boolean', default: false },
    split: { type: 'string' },
    lang: { type: 'string' },
    model: { type: 'string', default: 'claude-haiku-5-5' },
    again: { type: 'boolean', default: false },
  },
})

const lines = (path: string) => readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
const storedRuns = (): Array<{ file: string, run: EvalRun }> =>
  existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).filter(file => file.endsWith('.json')).sort().map(file => ({ file, run: JSON.parse(readFileSync(`${RUNS_DIR}/${file}`, 'utf8')) as EvalRun })) : []

if (values.run) {
  const split = values.split
  if (split !== 'dev' && split !== 'test') throw new Error('--run needs --split dev or --split test')
  const langs = values.lang ? [values.lang] : ['en', 'de']
  if (!langs.every(lang => lang === 'en' || lang === 'de')) throw new Error('--lang is en or de')
  const key = process.env.ANTHROPIC_API_KEY?.trim() ?? ''
  if (!key) throw new Error('Set ANTHROPIC_API_KEY to record a run.')
  if (split === 'test' && !values.again) {
    const done = storedRuns().filter(({ run }) => run.split === 'test' && run.model === values.model && langs.includes(run.lang))
    if (done.length > 0) throw new Error(`A test run is already stored (${done.map(({ file }) => file).join(', ')}). The test split is run once; add --again only if that run is being replaced on purpose.`)
  }
  const items = lines(ITEMS_PATH) as LabelItem[]
  const meta = {
    painfoldVersion: (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
    commit: execSync('git rev-parse --short HEAD').toString().trim(),
  }
  mkdirSync(RUNS_DIR, { recursive: true })
  for (const lang of langs as Array<'en' | 'de'>) {
    console.log(`Running the ${split} split in ${lang === 'en' ? 'English' : 'German'} with ${values.model}…`)
    const run = await recordRun({
      items,
      split,
      lang,
      model: values.model,
      meta: { ...meta, createdAt: new Date().toISOString() },
      onProgress: (done, total) => process.stdout.write(`\r  ${done} of ${total}`),
      send: {
        tag: (payload, batch) => post(anthropicTaggingRequest(key, payload, batch)),
        merge: (system, asked, schema) => post(anthropicJsonRequest(key, values.model, system, asked, schema)),
      },
    })
    const file = runFileName(run)
    writeFileSync(`${RUNS_DIR}/${file}`, `${JSON.stringify(run, null, 1)}\n`)
    const price = PRICES[run.model]
    console.log(`\n  Wrote ${RUNS_DIR}/${file}: ${run.usage.input} tokens in, ${run.usage.output} out${price ? `, about $${((run.usage.input * price.input + run.usage.output * price.output) / 1_000_000).toFixed(4)}` : ''}.`)
  }
}

const labels = (Object.values(LABEL_PATHS) as string[]).filter(path => existsSync(path)).flatMap(path => lines(path) as ItemLabels[])
const mappings = existsSync(MAPPINGS_DIR) ? readdirSync(MAPPINGS_DIR).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(`${MAPPINGS_DIR}/${file}`, 'utf8')) as StoredMapping) : []
const results = await computeResults(storedRuns(), labels, mappings)

const percent = (rate: Rate) => {
  const value = valueOf(rate)
  return value === undefined ? '   n/a' : `${(value * 100).toFixed(0).padStart(4)}% (${rate.hits}/${rate.of})`
}
const pair = (scores: Scores) => `recall ${percent(scores.recall)}  precision ${percent(scores.precision)}`
if (results.runs.length === 0) console.log('No stored runs yet. Record one with --run --split dev.')
for (const run of results.runs) {
  console.log(`\n${run.file}`)
  console.log(`  ${run.texts} texts, ${run.notAnalyzed} not analyzed${run.merged ? '' : ', merging did not finish'}; themes: ${KINDS.map(kind => `${run.themes[kind]} ${kind}`).join(', ')}; quotes kept ${percent(run.quotes)}`)
  if (!run.scores) {
    console.log(`  No labels for ${run.lang} yet: run npm run labels:convert first.`)
    continue
  }
  for (const kind of KINDS) console.log(`  ${kind.padEnd(5)} presence ${pair(run.scores.presence[kind])}   grouping ${pair(run.scores.grouping[kind])}`)
  console.log(`  sentiment ${percent(run.scores.sentiment.correct)}   type ${percent(run.scores.type.correct)}`)
  if (run.scores.tags) for (const kind of KINDS) console.log(`  ${kind.padEnd(5)} tags ${pair(run.scores.tags[kind])}   (mapped by ${run.scores.mappedBy})`)
}
for (const entry of results.stability) {
  console.log(`\nStability, ${entry.split} ${entry.lang} ${entry.model}: presence agrees ${percent(entry.presence)}; grouping ${KINDS.map(kind => `${kind} ${pair(entry.grouping[kind])}`).join('; ')}`)
}

if (values.write || values.run) {
  writeFileSync(RESULTS_PATH, resultsJson(results))
  writeFileSync(ANALYSIS_DOCS_PATH, withAnalysis(readFileSync(ANALYSIS_DOCS_PATH, 'utf8'), analysisMarkdown(results)))
  console.log(`\nWrote ${RESULTS_PATH} and the analysis section of ${ANALYSIS_DOCS_PATH}`)
}
