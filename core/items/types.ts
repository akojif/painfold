// Feedback items (#86): every file becomes a list of items, each a piece of
// text and where it came from. Detection, review and export work on items, so
// they do not depend on rows and columns, and later sources (interview
// transcripts, documents) only need a new adapter. Only cells are read today.

/**
 * Where a piece of text, or a unit of them, came from. A sheet is its position
 * in the workbook, counted from 0, never its name: sheet names are chosen by
 * people and can hold personal data ("Kunde Huber").
 */
export type Source
  = | { kind: 'cell', sheet: number, row: number, column: number }
    | { kind: 'row', sheet: number, row: number }
    | { kind: 'turn', index: number, speaker?: string, start?: number, end?: number }
    | { kind: 'paragraph', index: number, page?: number }

/**
 * A piece of feedback text to check, review and clean. The id comes from the
 * source location, so it is the same for a given file whatever else is
 * chosen, and a quote can always be linked back to where it came from.
 */
export type Item = {
  id: string
  text: string
  source: Source
  /** The unit it belongs to. */
  unit: string
}

/**
 * What groups items: a table row today, a speaker turn or a page later.
 * attributes is context for analysis and the report (segments and trends),
 * such as date, channel, plan or country: values the user chose to keep as
 * they are. They are never checked text, and never from a dropped column.
 */
export type Unit = {
  id: string
  source: Source
  attributes: Record<string, string>
}

/** A file read as items, in reading order, and the units that group them. */
export type ItemSet = { items: Item[], units: Unit[] }
