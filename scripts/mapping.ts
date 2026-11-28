// The theme mapping for the final test run (#129); see scripts/theme-mapping.ts.
//
//   npm run mapping:sheet -- test-en-claude-haiku-5-5-<time>.json
//       writes data/eval/analysis/mapping-<run>.xlsx, in the run's language, to hand to the person mapping
//   npm run mapping:convert -- path/to/mapping-<run>.xlsx
//       checks a filled sheet and, only when it has no problems, writes data/eval/analysis/mappings/<run>.json;
//       then npm run eval:analysis -- --write adds tag-level recall and precision for that run
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { read, write } from 'xlsx'
import { replayEvalRun, RUNS_DIR, type EvalRun } from './analysis-runs.ts'
import type { ItemLabels } from './labels.ts'
import { goldNames, goldThemes, mappingRows, mappingWorkbook, MAPPINGS_DIR, readMapping } from './theme-mapping.ts'

const [command, argument] = process.argv.slice(2).filter(value => value !== '--')
if ((command !== 'sheet' && command !== 'convert') || !argument) {
  console.error('Usage: npm run mapping:sheet -- <run file>   or   npm run mapping:convert -- <filled sheet>')
  process.exit(2)
}

// The run a sheet belongs to: the run file itself, or the name inside mapping-<run>.xlsx.
const runFile = command === 'sheet' ? basename(argument) : basename(argument).replace(/^mapping-/, '').replace(/\.xlsx$/, '.json')
const runPath = `${RUNS_DIR}/${runFile}`
if (!existsSync(runPath)) throw new Error(`No stored run ${runPath}`)
const run = JSON.parse(readFileSync(runPath, 'utf8')) as EvalRun
const labelsPath = `data/eval/analysis/labels-${run.lang}.jsonl`
if (!existsSync(labelsPath)) throw new Error(`No labels for ${run.lang} yet (${labelsPath}): run npm run labels:convert first.`)
const labels = (readFileSync(labelsPath, 'utf8').trim().split('\n').map(line => JSON.parse(line)) as ItemLabels[]).filter(label => label.split === run.split)
const rows = mappingRows((await replayEvalRun(run)).counted)
const gold = goldNames(labels)

if (command === 'sheet') {
  const out = `data/eval/analysis/mapping-${runFile.replace(/\.json$/, '.xlsx')}`
  writeFileSync(out, write(mappingWorkbook(runFile, run.lang, rows, goldThemes(labels)), { type: 'buffer', bookType: 'xlsx' }))
  console.log(`Wrote ${out}: ${rows.length} model themes to map to ${Object.values(gold).flat().length} gold themes (${run.lang === 'en' ? 'English' : 'German'}).`)
}
else {
  const { stored, findings } = readMapping(read(readFileSync(argument)), runFile, run.lang, rows, gold)
  for (const { where, message } of findings) console.log(`  Problem  ${where}: ${message}`)
  if (!stored) {
    console.log(`${argument}: ${findings.length} problem${findings.length === 1 ? '' : 's'}; nothing was written.`)
    process.exit(1)
  }
  mkdirSync(MAPPINGS_DIR, { recursive: true })
  writeFileSync(`${MAPPINGS_DIR}/${runFile}`, `${JSON.stringify(stored, null, 2)}\n`)
  console.log(`Wrote ${MAPPINGS_DIR}/${runFile}, mapped by ${stored.mappedBy}. Now run npm run eval:analysis -- --write.`)
}
