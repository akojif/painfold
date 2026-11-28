// CI's dependency audit: runs `npm audit --json` and fails on high or critical
// advisories, except the dated exceptions in scripts/audit-check.ts.
//
//   npm run audit
import { spawnSync } from 'node:child_process'
import { checkAudit, type AuditReport } from './audit-check.ts'

// npm audit exits non-zero whenever it finds anything, so its exit code is not the verdict.
const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let report: AuditReport
try {
  report = JSON.parse(run.stdout) as AuditReport
}
catch {
  console.error('npm audit did not return a report:\n' + run.stderr)
  process.exit(1)
}
if (!report.vulnerabilities) {
  console.error('npm audit returned no vulnerability list:\n' + run.stdout.slice(0, 2000))
  process.exit(1)
}

const { failures, skipped } = checkAudit(report, new Date().toISOString().slice(0, 10))
for (const line of skipped) console.log(`Skipped (dated exception): ${line}`)
for (const line of failures) console.error(`Failed: ${line}`)
console.log(failures.length === 0 ? 'No high or critical advisories outside the exceptions.' : `${failures.length} failing.`)
process.exit(failures.length === 0 ? 0 : 1)
