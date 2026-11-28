import { describe, expect, it } from 'vitest'
import { checkAudit, EXCEPTIONS, type AuditException, type AuditReport } from '../../scripts/audit-check'

const exception: AuditException = { id: 'GHSA-aaaa-bbbb-cccc', expires: '2026-12-01', reason: 'Invented for the test.', issue: '#0' }
const advisory = (id: string, severity: string) => ({ source: 1, title: `Advisory ${id}`, url: `https://github.com/advisories/${id}`, severity })
const report: AuditReport = {
  vulnerabilities: {
    'pkg-a': { via: [advisory('GHSA-aaaa-bbbb-cccc', 'high')] },
    'pkg-b': { via: ['pkg-a'] },
  },
}

describe('checkAudit', () => {
  it('skips an excepted advisory, by exact ID, until the day it expires', () => {
    expect(checkAudit(report, '2026-11-30', [exception])).toEqual({ failures: [], skipped: ['high GHSA-aaaa-bbbb-cccc: Advisory GHSA-aaaa-bbbb-cccc'] })
    const expired = checkAudit(report, '2026-12-01', [exception])
    expect(expired.skipped).toEqual([])
    expect(expired.failures).toHaveLength(2)
    expect(expired.failures[0]).toMatch(/expired on 2026-12-01\. Recheck picomatch/)
  })

  it('still fails on every other high or critical advisory, and ignores lower severities as before', () => {
    const more: AuditReport = {
      vulnerabilities: {
        ...report.vulnerabilities,
        'pkg-c': { via: [advisory('GHSA-aaaa-bbbb-cccd', 'critical'), advisory('GHSA-zzzz-zzzz-zzzz', 'moderate')] },
        'pkg-d': { via: [advisory('GHSA-dddd-dddd-dddd', 'high')] },
      },
    }
    expect(checkAudit(more, '2026-11-17', [exception]).failures).toEqual([
      'critical GHSA-aaaa-bbbb-cccd: Advisory GHSA-aaaa-bbbb-cccd',
      'high GHSA-dddd-dddd-dddd: Advisory GHSA-dddd-dddd-dddd',
    ])
  })

  it('fails on an expired exception even when its advisory is gone', () => {
    expect(checkAudit({ vulnerabilities: {} }, '2026-12-02', [exception]).failures).toHaveLength(1)
  })

  it('has one exception, for the picomatch advisory, with a reason and a tracking issue', () => {
    expect(EXCEPTIONS.map(entry => [entry.id, entry.expires, entry.issue])).toEqual([
      ['GHSA-fc5q-39xc-vjpf', '2027-01-01', 'https://github.com/akojif/painfold/issues/167'],
    ])
  })
})
