import { cleanedFileName, cleanedTable, toCsv } from '~~/core/export/csv'

/**
 * The cleaned file: its name, and its download. Used by the Download page and
 * the report (#142), so the file is always built the same way, from the
 * review as it is now.
 */
export function useCleanedFile() {
  const session = useSession()
  const { table, roles, review } = session
  const fileName = computed(() => cleanedFileName(table.value?.fileName ?? ''))

  function download() {
    if (!table.value || !review.value) return
    session.markDownloaded()
    saveTextFile(fileName.value, toCsv(cleanedTable(table.value, roles.value, review.value), { delimiter: table.value.delimiter ?? ',' }))
  }

  return { fileName, download }
}
