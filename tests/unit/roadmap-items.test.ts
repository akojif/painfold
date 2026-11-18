import { describe, expect, it } from 'vitest'
import { capped, COLUMN_CAP, COLUMNS, columnOf, RELEASES_SHOWN, releasesOf, ROADMAP_ITEMS, statusCounts } from '../../app/utils/roadmap-items'
import { readMessages } from '../../i18n/messages'
import { items as large } from '../fixtures/roadmap-large'

// The roadmap page's data and the rules that keep it readable as it grows.
describe('the roadmap items', () => {
  it('date only released versions, and give every item a name and summary in both languages', () => {
    for (const item of ROADMAP_ITEMS) expect(Boolean(item.released), item.id).toBe(item.status === 'released')
    for (const lang of ['en', 'de'] as const) {
      const text = (readMessages(lang) as unknown as { roadmap: { items: Record<string, { name: string, summary: string }> } }).roadmap.items
      for (const item of ROADMAP_ITEMS) expect(text[item.id]?.name && text[item.id]?.summary, `${lang} ${item.id}`).toBeTruthy()
    }
  })

  it('count the summary line from the same list as the columns', () => {
    const counts = statusCounts(ROADMAP_ITEMS)
    expect(counts.inProgress + counts.planned + counts.idea).toBe(COLUMNS.flatMap(column => columnOf(ROADMAP_ITEMS, column)).length)
  })
})

describe('a long roadmap (fixture)', () => {
  it('shows the newest releases first, and the rest on request', () => {
    const releases = releasesOf(large)
    expect(releases).toHaveLength(10)
    expect(releases[0]!.version).toBe('v0.10.0')
    expect(capped(releases, RELEASES_SHOWN, false)).toMatchObject({ more: 7 })
    expect(capped(releases, RELEASES_SHOWN, false).shown.map(item => item.version)).toEqual(['v0.10.0', 'v0.9.0', 'v0.8.0'])
    expect(capped(releases, RELEASES_SHOWN, true)).toMatchObject({ more: 0 })
  })

  it('caps every column at four cards, keeps the list order, and leaves an empty column empty', () => {
    const sizes = Object.fromEntries(COLUMNS.map(column => [column, columnOf(large, column).length]))
    expect(sizes).toEqual({ now: 3, next: 0, later: 19, idea: 8 })
    const later = columnOf(large, 'later')
    expect(capped(later, COLUMN_CAP, false)).toMatchObject({ more: 15 })
    expect(capped(later, COLUMN_CAP, false).shown).toEqual(later.slice(0, 4))
    expect(capped(columnOf(large, 'now'), COLUMN_CAP, false)).toMatchObject({ more: 0 })
    expect(capped(columnOf(large, 'next'), COLUMN_CAP, false).shown).toEqual([])
    expect(statusCounts(large)).toEqual({ inProgress: 3, planned: 19, idea: 8 })
  })
})
