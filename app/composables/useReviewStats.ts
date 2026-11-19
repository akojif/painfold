// The review's counts per type and per decision, for the workspace's filters and charts.
import { PII_TYPES, type PiiType } from '~~/core/pii-types'
import type { ReviewWs } from './useReviewWorkspace'

export type TypeStats = { type: PiiType, values: number, findings: number, pending: number, removed: number, kept: number }

export function useReviewStats(ws: ReviewWs) {
  const byType = computed<TypeStats[]>(() => {
    const stats = new Map<PiiType, TypeStats>()
    const seen = new Set<string>()
    for (const finding of ws.all) {
      const entry = stats.get(finding.type) ?? { type: finding.type, values: 0, findings: 0, pending: 0, removed: 0, kept: 0 }
      entry.findings++
      if (!seen.has(finding.key)) {
        seen.add(finding.key)
        entry.values++
        const decision = ws.review?.decisionFor(finding.key)
        if (decision === 'remove') entry.removed++
        else if (decision === 'keep') entry.kept++
        else entry.pending++
      }
      stats.set(finding.type, entry)
    }
    return [...stats.values()].sort((a, b) => b.findings - a.findings || PII_TYPES.indexOf(a.type) - PII_TYPES.indexOf(b.type))
  })
  const totals = computed(() => byType.value.reduce((sum, entry) => ({
    values: sum.values + entry.values,
    pending: sum.pending + entry.pending,
    removed: sum.removed + entry.removed,
    kept: sum.kept + entry.kept,
  }), { values: 0, pending: 0, removed: 0, kept: 0 }))
  const rows = computed(() => ws.items?.units.length ?? 0)
  const rowsWithFindings = computed(() => new Set([...ws.all.map(finding => finding.unit), ...ws.warnings.map(warning => warning.unit)]).size)
  /** The decision of one distinct value: pending, removed or kept. */
  const stateOf = (key: string) => {
    const decision = ws.review?.decisionFor(key)
    return decision === 'remove' ? 'removed' as const : decision === 'keep' ? 'kept' as const : 'pending' as const
  }
  return { byType, totals, rows, rowsWithFindings, stateOf }
}
