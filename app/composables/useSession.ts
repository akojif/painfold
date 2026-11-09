import type { ColumnRole, RoleSuggestion } from '~~/core/columns/roles'
import { guessFeedbackColumn, suggestRoles } from '~~/core/columns/roles'
import type { CellDetections } from '~~/core/detect/table'
import type { ImportedTable } from '~~/core/import'

// The file being cleaned and every decision about it. It lives only in this
// tab's memory: nothing is written to storage, and closing the tab clears it.
// Rows sit in a shallowRef so a large file is never made reactive cell by cell.
const table = shallowRef<ImportedTable>()
const isSample = ref(false)
const suggestions = shallowRef<RoleSuggestion[]>([])
const roles = ref<ColumnRole[]>([])
const feedbackColumn = ref<number>()
const findings = shallowRef<CellDetections[]>()

export function useSession() {
  function load(imported: ImportedTable, sample = false) {
    table.value = imported
    isSample.value = sample
    suggestions.value = suggestRoles(imported)
    roles.value = suggestions.value.map(suggestion => suggestion.role)
    feedbackColumn.value = undefined
    findings.value = undefined
    setFeedbackColumn(guessFeedbackColumn(imported))
  }

  /** The feedback column is always checked; the previous one gets its suggested role back. */
  function setFeedbackColumn(index: number | undefined) {
    const previous = feedbackColumn.value
    if (previous !== undefined) roles.value[previous] = suggestions.value[previous]!.role
    feedbackColumn.value = index
    if (index !== undefined) roles.value[index] = 'scan'
  }

  function clear() {
    table.value = undefined
    isSample.value = false
    suggestions.value = []
    roles.value = []
    feedbackColumn.value = undefined
    findings.value = undefined
  }

  const scanColumns = computed(() => roles.value.flatMap((role, index) => (role === 'scan' ? [index] : [])))

  return { table, isSample, suggestions, roles, feedbackColumn, findings, scanColumns, load, setFeedbackColumn, clear }
}
