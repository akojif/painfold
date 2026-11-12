import { findIndirect } from '../detect/indirect/index.ts'
import type { IndirectReason, IndirectType } from '../detect/indirect/index.ts'
import { outside } from '../detect/merge.ts'
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

/**
 * An indirect identifier (core/detect/indirect/): text that can point to one
 * person together with what else is known. Unlike a finding, a warning nobody
 * decided on is kept; only Remove replaces it with a placeholder.
 */
export type Warning = {
  /** Where it is ("row:column:start:end"): decisions follow the position, so a warning found again keeps its decision. */
  key: string
  row: number
  column: number
  start: number
  end: number
  type: IndirectType
  reason: IndirectReason
  value: string
  /** For a role with a place: the place it is linked to. */
  place?: { start: number, end: number, value: string }
}

export type WarningDecision = 'remove' | 'dismiss'

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
  /** Warnings by cell ("row:column"), in order. */
  private readonly warningsByCell = new Map<string, Warning[]>()
  private readonly warningDecisions = new Map<string, WarningDecision>()

  constructor(rows: readonly (readonly string[])[], columns: readonly number[], cells: readonly CellDetections[]) {
    this.rows = rows
    this.columns = columns
    for (const cell of cells) {
      for (const found of cell.detections) this.add({ row: cell.row, column: cell.column, ...found }, 'detected')
    }
    this.sort()
    for (const row of this.rows.keys()) {
      for (const column of columns) this.refreshWarnings(row, column)
    }
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

  /** Removes every finding nobody decided on yet, optionally of one type only, as one step that can be undone. */
  removeAllLeft(type?: PiiType): number {
    const left = this.list.filter(finding => !this.decisions.has(finding.key) && (!type || finding.type === type))
    const pending = [...new Set(left.map(finding => finding.key))]
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
    this.refreshWarningsIn(added)
    this.history.push(() => {
      this.list = this.list.filter(finding => !ids.has(finding.id))
      this.cellIndex = undefined
      this.refreshWarningsIn(added)
      this.restore(key, previous)
    })
    return added
  }

  /**
   * Adds findings that arrive after the review started: names and places from
   * the name model, found in the background. The part of one that an existing
   * finding already covers is cut off (core/detect/merge.ts), so rule findings
   * and marked text come first and what is left is still removed. A
   * decision already made for the same value applies to the new copies too.
   * Arriving findings are not a step that undo takes back.
   */
  addDetected(cells: readonly CellDetections[]): Finding[] {
    const added: Finding[] = []
    for (const cell of cells) {
      // Before any new finding of this cell is added: the name model's own findings never overlap each other.
      const existing = this.findingsIn(cell.row, cell.column)
      const text = this.rows[cell.row]?.[cell.column] ?? ''
      for (const found of cell.detections) {
        for (const part of outside(text, found, existing)) added.push(this.add({ row: cell.row, column: cell.column, ...part }, 'detected'))
      }
    }
    if (added.length > 0) this.sort()
    // New places can link a job title to a place, and new findings can cover a warning.
    this.refreshWarningsIn(cells)
    return added
  }

  /** Every warning, in reading order. */
  get warnings(): readonly Warning[] {
    return [...this.warningsByCell.values()].flat().sort((a, b) => a.row - b.row || a.column - b.column || a.start - b.start)
  }

  warningDecisionFor(key: string): WarningDecision | undefined {
    return this.warningDecisions.get(key)
  }

  /** Removes a warning's text or dismisses the warning, as a step that can be undone. */
  decideWarning(key: string, decision: WarningDecision): void {
    const previous = this.warningDecisions.get(key)
    if (previous === decision) return
    this.warningDecisions.set(key, decision)
    this.history.push(() => this.restoreWarning(key, previous))
  }

  /** Decides every open warning the same way, as one step that can be undone. Returns how many were decided. */
  decideAllWarnings(decision: WarningDecision): number {
    const open = this.warnings.filter(warning => !this.warningDecisions.has(warning.key)).map(warning => warning.key)
    if (open.length === 0) return 0
    for (const key of open) this.warningDecisions.set(key, decision)
    this.history.push(() => open.forEach(key => this.warningDecisions.delete(key)))
    return open.length
  }

  warningCounts(): { total: number, removed: number, dismissed: number, open: number } {
    const all = this.warnings
    const removed = all.filter(warning => this.warningDecisions.get(warning.key) === 'remove').length
    const dismissed = all.filter(warning => this.warningDecisions.get(warning.key) === 'dismiss').length
    return { total: all.length, removed, dismissed, open: all.length - removed - dismissed }
  }

  /**
   * Whether the place a role warning is linked to will be removed: a place
   * finding over it that nobody kept. The interface then says the role is
   * less identifying. False for warnings without a place.
   */
  placeRemoved(warning: Warning): boolean {
    const place = warning.place
    if (!place) return false
    return this.findingsIn(warning.row, warning.column)
      .some(finding => finding.type === 'PLACE' && finding.start < place.end && finding.end > place.start && this.decisions.get(finding.key) !== 'keep')
  }

  placeholderForWarning(warning: Pick<Warning, 'type' | 'value'>): string {
    return this.placeholders.placeholderFor(warning.type, warning.value)
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
    // Warnings never overlap findings, so both can be replaced in one pass.
    const replaced = [
      ...this.findingsIn(row, column)
        .filter(finding => this.decisions.get(finding.key) !== 'keep')
        .map(finding => ({ start: finding.start, end: finding.end, placeholder: this.placeholderFor(finding) })),
      ...(this.warningsByCell.get(`${row}:${column}`) ?? [])
        .filter(warning => this.warningDecisions.get(warning.key) === 'remove')
        .map(warning => ({ start: warning.start, end: warning.end, placeholder: this.placeholderForWarning(warning) })),
    ].sort((a, b) => a.start - b.start)
    let result = ''
    let last = 0
    for (const { start, end, placeholder } of replaced) {
      result += text.slice(last, start) + placeholder
      last = end
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

  /** Finds a cell's warnings again from its text and its findings: places link roles, and findings cover warnings. */
  private refreshWarnings(row: number, column: number) {
    const text = this.rows[row]?.[column] ?? ''
    const cell = `${row}:${column}`
    if (!text) {
      this.warningsByCell.delete(cell)
      return
    }
    const findings = this.findingsIn(row, column)
    const places = findings.filter(finding => finding.type === 'PLACE')
    const warnings: Warning[] = findIndirect(text, places)
      .filter(found => findings.every(finding => found.end <= finding.start || found.start >= finding.end))
      .map(found => ({ ...found, row, column, key: `${row}:${column}:${found.start}:${found.end}` }))
    for (const warning of warnings) this.placeholderForWarning(warning)
    if (warnings.length > 0) this.warningsByCell.set(cell, warnings)
    else this.warningsByCell.delete(cell)
  }

  private refreshWarningsIn(cells: ReadonlyArray<{ row: number, column: number }>) {
    const seen = new Set<string>()
    for (const { row, column } of cells) {
      if (seen.has(`${row}:${column}`)) continue
      seen.add(`${row}:${column}`)
      this.refreshWarnings(row, column)
    }
  }

  private restoreWarning(key: string, previous: WarningDecision | undefined) {
    if (previous) this.warningDecisions.set(key, previous)
    else this.warningDecisions.delete(key)
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
