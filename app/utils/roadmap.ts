// The stages on the /roadmap page, in order. Names, summaries and points are
// interface text, so they live in i18n/locales under roadmap.stages.<id>;
// tests/unit/roadmap.test.ts checks versions and names against ROADMAP.md.
// Change a status here when work on a stage starts or it is released; the
// start page's "What Painfold does" strip reads it too.
// preview: usable in the app, but not released: its quality numbers are not
// published yet. The release turns it into available.
// next: the stage after the current one, not started yet.
export type StageStatus = 'available' | 'preview' | 'inProgress' | 'next' | 'planned'
export type StageId = 'clean' | 'names' | 'jobs' | 'report' | 'sources' | 'launch'

export interface RoadmapStage {
  id: StageId
  version: string
  status: StageStatus
}

export const ROADMAP_STAGES: readonly RoadmapStage[] = [
  { id: 'clean', version: 'v0.1', status: 'available' },
  { id: 'names', version: 'v0.2', status: 'available' },
  { id: 'jobs', version: 'v0.3', status: 'available' },
  { id: 'report', version: 'v0.4', status: 'inProgress' },
  { id: 'sources', version: 'v0.5', status: 'planned' },
  { id: 'launch', version: 'v1.0', status: 'planned' },
]

/** The stage to highlight: the one in progress or in preview, or else the latest available one. */
export function currentStage(stages: readonly RoadmapStage[] = ROADMAP_STAGES): RoadmapStage | undefined {
  return stages.find(stage => stage.status === 'inProgress' || stage.status === 'preview') ?? stages.findLast(stage => stage.status === 'available')
}

/** A stage by its id. */
export const stageOf = (id: StageId): RoadmapStage => ROADMAP_STAGES.find(stage => stage.id === id)!

export const ROADMAP_URL = 'https://github.com/akojif/painfold/blob/main/ROADMAP.md'
