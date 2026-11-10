// Every check, run the same way locally and in CI, with one clear result.
//
//   npm run verify                       lint, typecheck, unit, build, model, e2e
//   npm run verify -- lint unit          only these steps, in this order
//
// Each step's output streams as it runs and is saved to node_modules/.cache/painfold-verify/
// (not test-results/, which Playwright empties when it starts).
// All steps run even after one fails, so every problem shows at once; a step
// that needs the build is skipped if the build failed. End-to-end tests always
// run against a build made in the same run, never a stale one. At the end a
// summary lists every step with its result, time and test counts (including
// skipped and flaky tests), the end of each failing step's log, and the exit
// code is 1 if anything failed. In CI the summary also goes to the job summary.
import { spawn } from 'node:child_process'
import { appendFileSync, createWriteStream, mkdirSync, readFileSync } from 'node:fs'
import { stripVTControlCharacters } from 'node:util'

type Step = { name: string, label: string, command: string[], needsBuild?: boolean }

const STEPS: Step[] = [
  { name: 'lint', label: 'Lint', command: ['npm', 'run', 'lint'] },
  { name: 'typecheck', label: 'Typecheck', command: ['npm', 'run', 'typecheck'] },
  { name: 'unit', label: 'Unit tests', command: ['npm', 'test'] },
  { name: 'build', label: 'Build', command: ['npm', 'run', 'generate'] },
  { name: 'model', label: 'Name model tests', command: ['npm', 'run', 'test:model'], needsBuild: true },
  { name: 'e2e', label: 'End-to-end tests', command: ['npx', 'playwright', 'test'], needsBuild: true },
]

const LOGS = 'node_modules/.cache/painfold-verify'

/** The steps asked for, in their fixed order; end-to-end tests bring the build with them. */
export function plan(requested: readonly string[]): Step[] {
  const unknown = requested.filter(name => !STEPS.some(step => step.name === name))
  if (unknown.length > 0) throw new Error(`Unknown step: ${unknown.join(', ')}. Steps: ${STEPS.map(step => step.name).join(', ')}`)
  const names = new Set(requested.length > 0 ? requested : STEPS.map(step => step.name))
  if (names.has('e2e')) names.add('build')
  return STEPS.filter(step => names.has(step.name))
}

/** The test counts a step's output reports: Vitest's "Tests  597 passed (597)", Playwright's "184 passed", "2 flaky" and so on. */
export function counts(output: string): string {
  // Colours would hide the numbers from the patterns below.
  const plain = stripVTControlCharacters(output)
  const vitest = plain.match(/^\s*Tests\s+(.+?)\s*$/m)?.[1]
  if (vitest) return vitest.replace(/\s*\(\d+\)$/, '')
  const playwright = [...plain.matchAll(/^\s{2}(\d+) (passed|failed|flaky|skipped|did not run|interrupted)\b/gm)].map(match => `${match[1]} ${match[2]}`)
  return playwright.join(', ')
}

type Result = { step: Step, status: 'passed' | 'failed' | 'skipped', seconds: number, counts: string, log: string }

function run(step: Step): Promise<Result> {
  const log = `${LOGS}/${step.name}.log`
  const file = createWriteStream(log)
  const started = Date.now()
  console.log(`\n▶ ${step.label}: ${step.command.join(' ')}\n`)
  let output = ''
  return new Promise((resolve) => {
    const child = spawn(step.command[0]!, step.command.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } })
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk: Buffer) => {
        process.stdout.write(chunk)
        file.write(chunk)
        output += chunk.toString()
      })
    }
    child.on('close', (code) => {
      file.end(() => resolve({ step, status: code === 0 ? 'passed' : 'failed', seconds: (Date.now() - started) / 1000, counts: counts(output), log }))
    })
  })
}

const tail = (log: string, lines = 40) => stripVTControlCharacters(readFileSync(log, 'utf8')).trimEnd().split('\n').slice(-lines).join('\n')

async function main() {
  mkdirSync(LOGS, { recursive: true })
  const results: Result[] = []
  for (const step of plan(process.argv.slice(2))) {
    const buildFailed = results.some(result => result.step.name === 'build' && result.status !== 'passed')
    if (step.needsBuild && buildFailed) {
      results.push({ step, status: 'skipped', seconds: 0, counts: 'needs the build', log: '' })
      continue
    }
    results.push(await run(step))
  }

  const failed = results.filter(result => result.status === 'failed')
  for (const result of failed) console.log(`\n✗ ${result.step.label} failed. Last lines of ${result.log}:\n\n${tail(result.log)}`)

  const mark = { passed: '✓', failed: '✗', skipped: '–' }
  const rows = results.map(result => [`${mark[result.status]} ${result.step.label}`, result.status, `${result.seconds.toFixed(0)} s`, result.counts])
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map(row => row[column]!.length)))
  console.log(`\nVerify summary\n${rows.map(row => row.map((cell, column) => cell.padEnd(widths[column]!)).join('   ')).join('\n')}`)
  const flaky = results.some(result => /\bflaky\b/.test(result.counts))
  console.log(failed.length > 0 ? `\n${failed.length} of ${results.length} steps failed. Logs are in ${LOGS}/.` : `\nAll ${results.length} steps passed${flaky ? ', some tests only on retry (flaky): look at them' : ''}.`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Verify\n\n| Step | Result | Time | Tests |\n| --- | --- | ---: | --- |\n${rows.map(([label, status, time, testCounts]) => `| ${label} | ${status} | ${time} | ${testCounts} |`).join('\n')}\n`)
  }
  process.exitCode = failed.length > 0 ? 1 : 0
}

if (import.meta.main) await main()
