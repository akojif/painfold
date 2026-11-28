import type { ColumnRole } from '../columns/roles.ts'
import { rebuildTable, sheetIndexOf } from '../items/table.ts'
import type { Review } from '../review/review.ts'

/**
 * A cell that starts with =, +, - or @ (also after leading spaces), a tab or a
 * carriage return can run as a formula when the file is opened in Excel,
 * LibreOffice or Google Sheets (CSV injection). Such cells get a leading
 * apostrophe, which spreadsheets read as "this is text". Plain numbers such
 * as -12,50 cannot run and are left alone.
 */
export function neutralizeFormula(cell: string): string {
  const triggers = /^(?:\s*[=+\-@]|[\t\r])/
  const plainNumber = /^[+-]?\d[\d.,]*$/
  return triggers.test(cell) && !plainNumber.test(cell.trim()) ? `'${cell}` : cell
}

function quote(cell: string, delimiter: string): string {
  return cell.includes('"') || cell.includes(delimiter) || /[\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell
}

export type CleanedFile = { header: string[], rows: string[][] }

/**
 * The cleaned table: dropped columns left out, checked columns with
 * placeholders, the rest unchanged. Each checked cell is a feedback item, put
 * back through its location by the table adapter.
 */
export function cleanedTable(table: { columns: string[], rows: string[][], sheetNames?: string[], sheetName?: string }, roles: readonly ColumnRole[], review: Review): CleanedFile {
  return rebuildTable({ ...table, sheetIndex: sheetIndexOf(table) }, roles, item => review.cleanedItem(item.id))
}

/**
 * The cleaned file as CSV text, data only: a byte order mark so Excel reads
 * UTF-8, CRLF line endings, and every cell protected against formulas. Notes
 * about the cleaning go in the separate cleaning report.
 */
export function toCsv(file: CleanedFile, options: { delimiter?: string } = {}): string {
  const delimiter = options.delimiter ?? ','
  const line = (cells: string[]) => cells.map(cell => quote(neutralizeFormula(cell), delimiter)).join(delimiter)
  return `\uFEFF${[line(file.header), ...file.rows.map(line)].join('\r\n')}\r\n`
}

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '') || 'feedback'

/** The cleaned file's name: "tickets.xlsx" becomes "tickets_cleaned.csv" (later also .txt or .md, for transcripts and documents). */
export function cleanedFileName(fileName: string, extension = 'csv'): string {
  return `${baseName(fileName)}_cleaned.${extension}`
}

/** The cleaning report's name: "tickets.xlsx" becomes "tickets_cleaning-report.txt". */
export function reportFileName(fileName: string): string {
  return `${baseName(fileName)}_cleaning-report.txt`
}

/**
 * Removed values that still appear in an exported file. Used by the tests to
 * prove nothing removed reaches the download, and tested itself against an
 * unredacted export so the check cannot pass by accident.
 */
export function leakedValues(output: string, review: Review): string[] {
  const removed = review.findings.filter(finding => review.decisionFor(finding.key) !== 'keep').map(finding => finding.value)
  return [...new Set(removed)].filter(value => output.toLowerCase().includes(value.toLowerCase()))
}

/** How many findings of each type the cleaned file replaces. */
export function removedByType(review: Review): Map<string, number> {
  const counts = new Map<string, number>()
  for (const finding of review.findings) {
    if (review.decisionFor(finding.key) === 'keep') continue
    counts.set(finding.type, (counts.get(finding.type) ?? 0) + 1)
  }
  return counts
}
