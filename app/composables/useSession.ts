import type { ColumnRole, RoleSuggestion } from '~~/core/columns/roles'
import { guessFeedbackColumn, suggestRoles } from '~~/core/columns/roles'
import type { CellDetections } from '~~/core/detect/table'
import type { ImportedTable } from '~~/core/import'
import { Review } from '~~/core/review/review'

// The file being cleaned and every decision about it. It lives only in this
// tab's memory: nothing is written to storage, and closing the tab clears it.
// Rows and the review sit in shallowRefs so a large file is never made reactive
// cell by cell; `revision` changes whenever the review does.
const table = shallowRef<ImportedTable>()
const isSample = ref(false)
const suggestions = shallowRef<RoleSuggestion[]>([])
const roles = ref<ColumnRole[]>([])
const feedbackColumn = ref<number>()
const review = shallowRef<Review>()
const revision = ref(0)
// The column choices as suggested when the file was opened, as they were when
// the review started, and the state of the review when the cleaned file was
// last downloaded: together they say whether there is work to lose.
const suggestedChoices = ref('')
const reviewedChoices = ref('')
const downloadedAt = ref<{ revision: number, choices: string }>()

export function useSession() {
  const choices = computed(() => JSON.stringify([roles.value, feedbackColumn.value]))

  function load(imported: ImportedTable, sample = false) {
    table.value = imported
    isSample.value = sample
    suggestions.value = suggestRoles(imported)
    roles.value = suggestions.value.map(suggestion => suggestion.role)
    feedbackColumn.value = undefined
    review.value = undefined
    downloadedAt.value = undefined
    setFeedbackColumn(guessFeedbackColumn(imported))
    suggestedChoices.value = choices.value
  }

  /** The feedback column is always checked; the previous one gets its suggested role back. */
  function setFeedbackColumn(index: number | undefined) {
    const previous = feedbackColumn.value
    if (previous !== undefined) roles.value[previous] = suggestions.value[previous]!.role
    feedbackColumn.value = index
    if (index !== undefined) roles.value[index] = 'scan'
  }

  const scanColumns = computed(() => roles.value.flatMap((role, index) => (role === 'scan' ? [index] : [])))

  function startReview(cells: CellDetections[]) {
    if (!table.value) return
    review.value = new Review(table.value.rows, scanColumns.value, cells)
    reviewedChoices.value = choices.value
    revision.value++
  }

  /** The column choices differ from those the review was made with, so finding personal data again would reset it. */
  const columnsChanged = computed(() => Boolean(review.value) && choices.value !== reviewedChoices.value)

  /**
   * Whether leaving now would lose work: a review was started or column
   * choices were changed, and the cleaned file has not been downloaded since.
   */
  const hasWork = computed(() => {
    if (!table.value || (!review.value && choices.value === suggestedChoices.value)) return false
    const saved = downloadedAt.value
    return !saved || saved.revision !== revision.value || saved.choices !== choices.value
  })

  /** Called when the cleaned file is downloaded: until something changes, there is nothing to lose. */
  function markDownloaded() {
    downloadedAt.value = { revision: revision.value, choices: choices.value }
  }

  /** Runs a change to the review and tells the interface it happened. */
  function change<T>(update: (current: Review) => T): T | undefined {
    if (!review.value) return undefined
    const result = update(review.value)
    revision.value++
    return result
  }

  function clear() {
    table.value = undefined
    isSample.value = false
    suggestions.value = []
    roles.value = []
    feedbackColumn.value = undefined
    review.value = undefined
    downloadedAt.value = undefined
    suggestedChoices.value = ''
    reviewedChoices.value = ''
  }

  return { table, isSample, suggestions, roles, feedbackColumn, review, revision, scanColumns, columnsChanged, hasWork, load, setFeedbackColumn, startReview, change, markDownloaded, clear }
}
