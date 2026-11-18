// What the roadmap page shows: the released versions, the release in
// progress, and the open issues that are planned or only an idea. Names and
// summaries are interface text, in i18n/locales under roadmap.items.<id>.
// Dates are only the dates versions were released; nothing ahead is dated.
// Update a status when work starts or a version is released.

export type ItemStatus = 'released' | 'inProgress' | 'planned' | 'idea'
/** Where an item sits when the page groups by "now, next, later". */
export type Horizon = 'released' | 'now' | 'next' | 'later' | 'idea'
export type ItemId = 'clean' | 'names' | 'jobs' | 'workspace' | 'report' | 'landing' | 'namesMore' | 'transcripts' | 'documents' | 'docker' | 'engine' | 'mcp'

export interface RoadmapItem {
  id: ItemId
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
  { id: 'workspace', status: 'inProgress', horizon: 'now', version: 'v0.3.1', link: issue(141) },
  { id: 'report', status: 'planned', horizon: 'next', version: 'v0.4', link: { kind: 'milestone', label: 'v0.4', url: `${REPO}/milestone/4` } },
  { id: 'landing', status: 'planned', horizon: 'later', link: issue(97) },
  { id: 'namesMore', status: 'planned', horizon: 'later', link: issue(82) },
  { id: 'transcripts', status: 'planned', horizon: 'later', version: 'v0.5', link: issue(87) },
  { id: 'documents', status: 'planned', horizon: 'later', version: 'v0.5', link: issue(88) },
  { id: 'docker', status: 'planned', horizon: 'later', version: 'v1.0', link: issue(75) },
  { id: 'engine', status: 'idea', horizon: 'idea', link: issue(69) },
  { id: 'mcp', status: 'idea', horizon: 'idea', link: issue(157) },
]

export const HORIZONS: readonly Horizon[] = ['released', 'now', 'next', 'later', 'idea']
export const ITEM_STATUSES: readonly ItemStatus[] = ['released', 'inProgress', 'planned', 'idea']

/** The versions ahead, in order, then the items without a version. */
export function upcomingByVersion(items: readonly RoadmapItem[] = ROADMAP_ITEMS): Array<{ version?: string, items: RoadmapItem[] }> {
  const ahead = items.filter(item => item.status === 'inProgress' || item.status === 'planned')
  const versions = [...new Set(ahead.flatMap(item => (item.version ? [item.version] : [])))]
  return [
    ...versions.map(version => ({ version, items: ahead.filter(item => item.version === version) })),
    { items: ahead.filter(item => !item.version) },
  ].filter(group => group.items.length > 0)
}

/** Prototype only (proto/roadmap): the three page variations being compared. */
export const ROADMAP_VARIANTS = ['a', 'b', 'c'] as const
export type RoadmapVariant = typeof ROADMAP_VARIANTS[number]
