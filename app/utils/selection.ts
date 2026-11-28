// Maps the reader's text selection to character offsets in one feedback item.
// Every piece of an item's text is rendered in an element with data-item (the
// item's id) and data-offset (where the piece starts in the item), so offsets
// are exact.

export type ItemSelection = { item: string, start: number, end: number }
export type SelectionProblem = 'noSelection' | 'oneCell'

function locate(node: Node | null, offset: number) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null)
  const piece = element?.closest<HTMLElement>('[data-offset]')
  if (!piece?.dataset.item) return undefined
  return {
    item: piece.dataset.item,
    at: Number(piece.dataset.offset) + (node?.nodeType === Node.TEXT_NODE ? offset : 0),
  }
}

/** The selected text within one item, without surrounding spaces; a selection across items is a problem. */
export function selectedItemRange(selection: Selection | null, itemText: (item: string) => string): ItemSelection | SelectionProblem {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return 'noSelection'
  const anchor = locate(selection.anchorNode, selection.anchorOffset)
  const focus = locate(selection.focusNode, selection.focusOffset)
  if (!anchor || !focus) return 'noSelection'
  if (anchor.item !== focus.item) return 'oneCell'

  const text = itemText(anchor.item)
  let start = Math.min(anchor.at, focus.at)
  let end = Math.max(anchor.at, focus.at)
  while (start < end && /\s/.test(text[start]!)) start++
  while (end > start && /\s/.test(text[end - 1]!)) end--
  if (start === end) return 'noSelection'
  return { item: anchor.item, start, end }
}
