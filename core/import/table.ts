import { ImportError, MAX_ROWS } from './types.ts'

/**
 * Turns raw rows into column names and same-width data rows. The first
 * non-empty row is the header; blank or repeated header names get unique
 * fallbacks so every column can be picked.
 */
export function normalizeTable(raw: string[][]): { columns: string[], rows: string[][], raggedRows: number } {
  const nonEmpty = raw.filter(row => row.some(cell => cell.trim() !== ''))
  if (nonEmpty.length === 0) throw new ImportError('empty-file')

  const [header, ...data] = nonEmpty as [string[], ...string[][]]
  if (data.length === 0) throw new ImportError('no-rows')
  if (data.length > MAX_ROWS) throw new ImportError('too-many-rows', String(data.length))

  const width = Math.max(header.length, ...data.map(row => row.length))
  const columns = uniqueNames(Array.from({ length: width }, (_, i) => header[i]?.trim() || `Column ${i + 1}`))

  let raggedRows = 0
  const rows = data.map((row) => {
    if (row.length !== header.length) raggedRows++
    return Array.from({ length: width }, (_, i) => row[i] ?? '')
  })
  return { columns, rows, raggedRows }
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const key = name.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? name : `${name} (${count})`
  })
}
