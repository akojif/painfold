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
  /** What it is within its unit, for the interface: a column name today, a speaker later. */
  label?: string
  /**
   * How the review shows it: main is the feedback itself (shown first),
   * text is other free text (always shown, where missed names can hide),
   * short is a short value such as a channel or plan (shown only with a finding).
   */
  display: 'main' | 'text' | 'short'
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

/** Where a unit is, for the interface ("Row 17"); numbers count from 1. */
export type Place = { kind: 'row', number: number } | { kind: 'turn', number: number } | { kind: 'paragraph', number: number, page?: number }

export function placeOf(source: Source): Place {
  switch (source.kind) {
    case 'cell':
    case 'row':
      return { kind: 'row', number: source.row + 1 }
    case 'turn':
      return { kind: 'turn', number: source.index + 1 }
    case 'paragraph':
      return { kind: 'paragraph', number: source.index + 1, ...(source.page === undefined ? {} : { page: source.page }) }
  }
}

/** A file read as items, in reading order, and the units that group them. */
export type ItemSet = { items: Item[], units: Unit[] }
