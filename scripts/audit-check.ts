// Decides whether an `npm audit --json` report fails CI. Plain code, so it is
// tested without running npm: scripts/audit.ts runs the audit and prints the result.
//
// Like `npm audit --audit-level=high`, any high or critical advisory fails,
// except the exceptions below, matched by exact advisory ID. Each exception
// has an expiry date; from that date it fails the audit itself, so it cannot
// outlive its reason.

export type AuditException = { id: string, expires: string, reason: string, issue: string }

export const EXCEPTIONS: AuditException[] = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    expires: '2026-12-01',
    reason: 'picomatch ReDoS through repeated extglobs. Build-time only: picomatch comes in through Nuxt '
      + 'and its build tooling and only matches our own file patterns; the published site is static and '
      + 'never runs it on visitor input. No fixed release as of 2026-11-17 (every version up to 4.0.7, the newest).',
    issue: 'https://github.com/akojif/painfold/issues/167',
  },
]

const FAILING = new Set(['high', 'critical'])

type Advisory = { source?: number, title?: string, url?: string, severity?: string }
export type AuditReport = { vulnerabilities?: Record<string, { via: (string | Advisory)[] }> }

export type AuditResult = { failures: string[], skipped: string[] }

/** The GHSA ID at the end of an advisory URL, or the URL itself. */
const advisoryId = (advisory: Advisory) => advisory.url?.split('/').pop() ?? String(advisory.source)

/** `today` is a date as YYYY-MM-DD. */
export function checkAudit(report: AuditReport, today: string, exceptions = EXCEPTIONS): AuditResult {
  const failures: string[] = []
  const skipped: string[] = []
  for (const exception of exceptions) {
    if (today >= exception.expires) {
      failures.push(`The audit exception for ${exception.id} expired on ${exception.expires}. Recheck picomatch for a fixed release, `
        + `then update the lockfile and remove the exception from scripts/audit-check.ts, or renew it with a reason (${exception.issue}).`)
    }
  }
  // Every advisory once, however many packages depend on the vulnerable one.
  const advisories = new Map<string, Advisory>()
  for (const { via } of Object.values(report.vulnerabilities ?? {})) {
    for (const entry of via) if (typeof entry === 'object') advisories.set(advisoryId(entry), entry)
  }
  for (const [id, advisory] of advisories) {
    if (!FAILING.has(advisory.severity ?? '')) continue
    const line = `${advisory.severity} ${id}: ${advisory.title ?? ''}`
    if (exceptions.some(exception => exception.id === id && today < exception.expires)) skipped.push(line)
    else failures.push(line)
  }
  return { failures, skipped }
}
