import type { CellDetections } from '../detect/table.ts'
import type { PiiType } from '../pii-types.ts'
import { PlaceholderMap, valueKey } from '../redact/placeholders.ts'

export type Finding = {
  id: number
  row: number
  column: number
  start: number
  end: number
  type: PiiType
  value: string
  /** Same key, same value: a decision applies to every copy. */
  key: string
  source: 'detected' | 'marked' | 'form'
  /** For a possible form of marked text ("Annas" for "Anna"): the text that was marked. */
  formOf?: string
}

export type Decision = 'remove' | 'keep'

export class OverlapError extends Error {
  constructor() {
    super('The selection overlaps a finding')
    this.name = 'OverlapError'
  }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const NOT_A_WORD_BEFORE = '(?<![\\p{L}\\p{N}])'
const NOT_A_WORD_AFTER = '(?![\\p{L}\\p{N}])'

/**
 * Possessive and genitive endings of marked text: "Annas", "Anna's", "Annas'"
 * in German and English, and "Hans'" or "James'" for words ending in s, x, z
 * or ß. Only the marked part becomes a finding, so the ending stays in the text.
 */
function formEndings(value: string): string {
  const endings = ['s', "'s", '’s', "s'", 's’']
  if (/[sxzß]$/i.test(value)) endings.push("'", '’')
  return `(?:${endings.map(escapeRegExp).join('|')})`
}

/**
 * Everything decided during review: which findings exist, and for each value
 * whether it is removed or kept. A decision applies to every copy of a value.
 * Findings nobody decided on are removed when the file is cleaned. Placeholder
 * numbers are fixed when a value is first seen and never change during review.
 */
export class Review {
  readonly rows: readonly (readonly string[])[]
  readonly columns: readonly number[]
  private list: Finding[] = []
  private readonly decisions = new Map<string, Decision>()
  private readonly history: Array<() => void> = []
  private readonly placeholders = new PlaceholderMap()
  private nextId = 1
  /** Findings by cell, rebuilt when findings change, so cleaning a large file stays fast. */
  private cellIndex?: Map<string, Finding[]>

  constructor(rows: readonly (readonly string[])[], columns: readonly number[], cells: readonly CellDetections[]) {
    this.rows = rows
    this.columns = columns
    for (const cell of cells) {
      for (const found of cell.detections) this.add({ row: cell.row, column: cell.column, ...found }, 'detected')
    }
    this.sort()
  }

  get findings(): readonly Finding[] {
    return this.list
  }

  decisionFor(key: string): Decision | undefined {
    return this.decisions.get(key)
  }

  placeholderFor(finding: Pick<Finding, 'type' | 'value' | 'formOf'>): string {
    return this.placeholders.placeholderFor(finding.type, finding.formOf ?? finding.value)
  }

  copiesOf(key: string): Finding[] {
    return this.list.filter(finding => finding.key === key)
  }

  counts(): { total: number, reviewed: number, left: number } {
    const reviewed = this.list.filter(finding => this.decisions.has(finding.key)).length
    return { total: this.list.length, reviewed, left: this.list.length - reviewed }
  }

  decide(key: string, decision: Decision): void {
    const previous = this.decisions.get(key)
    if (previous === decision) return
    this.decisions.set(key, decision)
    this.history.push(() => this.restore(key, previous))
  }

  /** Removes every finding nobody decided on yet, as one step that can be undone. */
  removeAllLeft(): number {
    const pending = [...new Set(this.list.filter(finding => !this.decisions.has(finding.key)).map(finding => finding.key))]
    if (pending.length === 0) return 0
    for (const key of pending) this.decisions.set(key, 'remove')
    this.history.push(() => pending.forEach(key => this.decisions.delete(key)))
    return pending.length
  }

  /**
   * Marks text the detectors missed as personal data. Every other copy of the
   * same text in the checked columns is marked too, and removed. Possible
   * forms of it ("Annas", "Anna's") are flagged for review, not decided, and
   * share its placeholder. Throws OverlapError if the selection overlaps an
   * existing finding.
   */
  markMissed(row: number, column: number, start: number, end: number, type: PiiType): Finding[] {
    const text = this.rows[row]?.[column] ?? ''
    const value = text.slice(start, end)
    if (!value.trim() || value !== value.trim()) throw new RangeError('Mark a value without surrounding spaces')
    if (this.overlaps(row, column, start, end)) throw new OverlapError()

    const escaped = escapeRegExp(value)
    // "Anna's" is a possible form, not a copy, even though ' is not a letter.
    const copy = new RegExp(`${NOT_A_WORD_BEFORE}${escaped}(?!${formEndings(value)}${NOT_A_WORD_AFTER})${NOT_A_WORD_AFTER}`, 'giu')
    const form = new RegExp(`${NOT_A_WORD_BEFORE}(${escaped})${formEndings(value)}${NOT_A_WORD_AFTER}`, 'giu')
    const added: Finding[] = [this.add({ row, column, start, end, type, value }, 'marked')]
    for (const [otherRow, cells] of this.rows.entries()) {
      for (const otherColumn of this.columns) {
        const cell = cells[otherColumn] ?? ''
        for (const match of cell.matchAll(copy)) {
          const otherStart = match.index
          if (otherRow === row && otherColumn === column && otherStart === start) continue
          if (this.overlaps(otherRow, otherColumn, otherStart, otherStart + match[0].length)) continue
          added.push(this.add({ row: otherRow, column: otherColumn, start: otherStart, end: otherStart + match[0].length, type, value: match[0] }, 'marked'))
        }
        for (const match of cell.matchAll(form)) {
          const formStart = match.index
          const formEnd = formStart + match[1]!.length
          if (this.overlaps(otherRow, otherColumn, formStart, formEnd)) continue
          added.push(this.add({ row: otherRow, column: otherColumn, start: formStart, end: formEnd, type, value: match[1]! }, 'form', value))
        }
      }
    }
    this.sort()

    const key = added[0]!.key
    const previous = this.decisions.get(key)
    this.decisions.set(key, 'remove')
    const ids = new Set(added.map(finding => finding.id))
    this.history.push(() => {
      this.list = this.list.filter(finding => !ids.has(finding.id))
      this.cellIndex = undefined
      this.restore(key, previous)
    })
    return added
  }

  /** Undoes the last decision, "remove all", or marked text. Returns false if there is nothing to undo. */
  undo(): boolean {
    const step = this.history.pop()
    step?.()
    return Boolean(step)
  }

  get canUndo(): boolean {
    return this.history.length > 0
  }

  /** The cell's text as it will be exported: removed and undecided findings become placeholders. */
  cleanedCell(row: number, column: number): string {
    const text = this.rows[row]?.[column] ?? ''
    let result = ''
    let last = 0
    for (const finding of this.findingsIn(row, column)) {
      if (this.decisions.get(finding.key) === 'keep') continue
      result += text.slice(last, finding.start) + this.placeholderFor(finding)
      last = finding.end
    }
    return result + text.slice(last)
  }

  private add(found: Omit<Finding, 'id' | 'key' | 'source' | 'formOf'>, source: Finding['source'], formOf?: string): Finding {
    // A form gets its own key, so it is reviewed separately from the marked text.
    const key = formOf
      ? `${valueKey(found.type, formOf)}\u0000form\u0000${found.value.toLowerCase()}`
      : valueKey(found.type, found.value)
    const finding: Finding = { ...found, id: this.nextId++, key, source, ...(formOf ? { formOf } : {}) }
    this.placeholders.placeholderFor(finding.type, formOf ?? finding.value)
    this.list.push(finding)
    return finding
  }

  private overlaps(row: number, column: number, start: number, end: number): boolean {
    return this.list.some(finding => finding.row === row && finding.column === column && start < finding.end && end > finding.start)
  }

  private restore(key: string, previous: Decision | undefined) {
    if (previous) this.decisions.set(key, previous)
    else this.decisions.delete(key)
  }

  private findingsIn(row: number, column: number): readonly Finding[] {
    if (!this.cellIndex) {
      this.cellIndex = new Map()
      for (const finding of this.list) {
        const key = `${finding.row}:${finding.column}`
        const cell = this.cellIndex.get(key)
        if (cell) cell.push(finding)
        else this.cellIndex.set(key, [finding])
      }
    }
    return this.cellIndex.get(`${row}:${column}`) ?? []
  }

  private sort() {
    this.cellIndex = undefined
    this.list.sort((a, b) => a.row - b.row || a.column - b.column || a.start - b.start)
  }
}
