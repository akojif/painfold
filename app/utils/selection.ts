// Maps the reader's text selection to character offsets in one cell. Every
// piece of row text is rendered in an element with data-row, data-column and
// data-offset (where the piece starts in the cell), so offsets are exact.

export type CellSelection = { row: number, column: number, start: number, end: number }
export type SelectionProblem = 'noSelection' | 'oneCell'

function locate(node: Node | null, offset: number) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null)
  const piece = element?.closest<HTMLElement>('[data-offset]')
  if (!piece) return undefined
  return {
    row: Number(piece.dataset.row),
    column: Number(piece.dataset.column),
    at: Number(piece.dataset.offset) + (node?.nodeType === Node.TEXT_NODE ? offset : 0),
  }
}

export function selectedCellRange(selection: Selection | null, cellText: (row: number, column: number) => string): CellSelection | SelectionProblem {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return 'noSelection'
  const anchor = locate(selection.anchorNode, selection.anchorOffset)
  const focus = locate(selection.focusNode, selection.focusOffset)
  if (!anchor || !focus) return 'noSelection'
  if (anchor.row !== focus.row || anchor.column !== focus.column) return 'oneCell'

  const text = cellText(anchor.row, anchor.column)
  let start = Math.min(anchor.at, focus.at)
  let end = Math.max(anchor.at, focus.at)
  while (start < end && /\s/.test(text[start]!)) start++
  while (end > start && /\s/.test(text[end - 1]!)) end--
  if (start === end) return 'noSelection'
  return { row: anchor.row, column: anchor.column, start, end }
}
