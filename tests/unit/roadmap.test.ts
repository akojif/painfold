import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { currentStage, ROADMAP_STAGES } from '../../app/utils/roadmap'
import { readMessages } from '../../i18n/messages'

const roadmap = readFileSync(new URL('../../ROADMAP.md', import.meta.url), 'utf8')
type StageText = { name: string, summary: string, points: string[] }
const locale = readMessages('en') as unknown as { roadmap: { stages: Record<string, StageText> } }
const stagesInRoadmap = [...roadmap.matchAll(/^## Stage \d+: (.+) \((v[\d.]+)\)$/gm)].map(([, name, version]) => ({ name, version }))

describe('roadmap page', () => {
  it('has the same stages, names and versions as ROADMAP.md, in the same order', () => {
    expect(stagesInRoadmap.length).toBeGreaterThan(0)
    expect(ROADMAP_STAGES.map(stage => ({ name: locale.roadmap.stages[stage.id]!.name, version: stage.version }))).toEqual(stagesInRoadmap)
  })

  it('gives every stage one sentence and at most three points', () => {
    for (const stage of ROADMAP_STAGES) {
      const text = locale.roadmap.stages[stage.id]!
      expect(text.summary, stage.id).toMatch(/^[^.]+\.$/)
      expect(text.points.length, stage.id).toBeGreaterThan(0)
      expect(text.points.length, stage.id).toBeLessThanOrEqual(3)
    }
  })

  it('highlights the stage in progress, or else the latest available one', () => {
    expect(currentStage()?.id).toBe('names')
    expect(currentStage([
      { id: 'clean', version: 'v0.1', status: 'available' },
      { id: 'names', version: 'v0.2', status: 'inProgress' },
    ])?.id).toBe('names')
  })
})
