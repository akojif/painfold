// What the roadmap page shows: the released versions, the work in progress,
// and the open issues that are planned or only an idea. Names and summaries
// are interface text, in i18n/locales under roadmap.items.<id>.
// Dates are only the dates versions were released; nothing ahead is dated.
// Within a column, items are listed in this order, most important first.
// Update a status when work starts or a version is released.

export type ItemStatus = 'released' | 'inProgress' | 'planned' | 'idea'
/** Where an item sits on the page: the released strip, or one of the columns. */
export type Horizon = 'released' | 'now' | 'next' | 'later' | 'idea'
export type Column = Exclude<Horizon, 'released'>

export interface RoadmapItem {
  /** The key of its name and summary under roadmap.items. */
  id: string
  status: ItemStatus
  horizon: Horizon
  /** The version it ships in, when one is set. */
  version?: string
  /** Release date, only for released versions. */
  released?: string
  /** Where it is tracked: a release, an issue or a milestone on GitHub. */
  link: { kind: 'release' | 'issue' | 'milestone', label: string, url: string }
}

const REPO = 'https://github.com/akojif/painfold'
const release = (tag: string) => ({ kind: 'release' as const, label: tag, url: `${REPO}/releases/tag/${tag}` })
const issue = (n: number) => ({ kind: 'issue' as const, label: `#${n}`, url: `${REPO}/issues/${n}` })

export const ROADMAP_ITEMS: readonly RoadmapItem[] = [
  { id: 'clean', status: 'released', horizon: 'released', version: 'v0.1.0', released: '2026-11-09', link: release('v0.1.0') },
  { id: 'names', status: 'released', horizon: 'released', version: 'v0.2.0', released: '2026-11-12', link: release('v0.2.0') },
  { id: 'jobs', status: 'released', horizon: 'released', version: 'v0.3.0', released: '2026-11-18', link: release('v0.3.0') },
  { id: 'workspace', status: 'released', horizon: 'released', version: 'v0.3.1', released: '2026-11-20', link: release('v0.3.1') },
  { id: 'report', status: 'inProgress', horizon: 'now', version: 'v0.4', link: { kind: 'milestone', label: 'v0.4', url: `${REPO}/milestone/4` } },
  { id: 'landing', status: 'planned', horizon: 'later', link: issue(97) },
  { id: 'namesMore', status: 'planned', horizon: 'later', link: issue(82) },
  { id: 'providers', status: 'planned', horizon: 'next', link: issue(181) },
  { id: 'transcripts', status: 'planned', horizon: 'later', version: 'v0.5', link: issue(87) },
  { id: 'documents', status: 'planned', horizon: 'later', version: 'v0.5', link: issue(88) },
  { id: 'docker', status: 'planned', horizon: 'later', version: 'v1.0', link: issue(75) },
  { id: 'engine', status: 'idea', horizon: 'idea', link: issue(69) },
  { id: 'mcp', status: 'idea', horizon: 'idea', link: issue(157) },
]

/** The columns after the released strip, in the order they are shown. */
export const COLUMNS: readonly Column[] = ['now', 'next', 'later', 'idea']
/** Cards shown per column, and releases in the strip, before "Show more". */
export const COLUMN_CAP = 4
export const RELEASES_SHOWN = 3

/** Released versions, newest first. */
export const releasesOf = (items: readonly RoadmapItem[]) =>
  items.filter(item => item.status === 'released').sort((a, b) => (b.released ?? '').localeCompare(a.released ?? ''))

/** One column's items, in the order of the list: most important first. */
export const columnOf = (items: readonly RoadmapItem[], column: Column) => items.filter(item => item.horizon === column)

/** How many items are in progress, planned and ideas, from the same list as the columns. */
export function statusCounts(items: readonly RoadmapItem[]): Record<Exclude<ItemStatus, 'released'>, number> {
  const count = (status: ItemStatus) => items.filter(item => item.status === status).length
  return { inProgress: count('inProgress'), planned: count('planned'), idea: count('idea') }
}

/** The first `cap` items, and how many more there are. */
export function capped<T>(list: readonly T[], cap: number, open: boolean): { shown: readonly T[], more: number } {
  return open || list.length <= cap ? { shown: list, more: 0 } : { shown: list.slice(0, cap), more: list.length - cap }
}
