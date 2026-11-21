import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROADMAP_ITEMS } from '../../app/utils/roadmap-items'
import type { AnalysisResults } from '../../scripts/analysis-results'
import type { AccuracyData } from '../../scripts/eval'
import { llmsTxt, privacySection, readSources } from '../../scripts/llms-txt'

// painfold.com/llms.txt is built from the site's own sources; these checks
// recompute every number and status from those sources, independently.
const sources = readSources()
const text = llmsTxt(sources)
const percent = (hits: number, of: number) => `${Math.round((hits / of) * 100)}%`

describe('llms.txt', () => {
  it('follows the llms.txt format: an H1 title, a summary in a blockquote, then sections', () => {
    const lines = text.split('\n')
    expect(lines[0]).toBe('# Painfold')
    expect(lines[2]).toMatch(/^> Painfold removes personal data/)
    expect(text.match(/^## .+$/gm)).toEqual(['## What it does', '## Privacy', '## What Painfold does not do', '## Accuracy', '## Roadmap', '## Links'])
  })

  it('states the version in package.json', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
    expect(text).toContain(`Current version: ${version}.`)
  })

  it('has the name accuracy of data/eval/accuracy.json', () => {
    const data = JSON.parse(readFileSync('data/eval/accuracy.json', 'utf8')) as AccuracyData
    const groups = data.names.groups.map(group => ({
      labelled: data.names.removal[group]!.de.labelled + data.names.removal[group]!.en.labelled,
      found: data.names.removal[group]!.de.found + data.names.removal[group]!.en.found,
    }))
    const all = groups.reduce((total, group) => ({ labelled: total.labelled + group.labelled, found: total.found + group.found }), { labelled: 0, found: 0 })
    const weakest = Math.min(...groups.map(group => group.found / group.labelled))
    expect(text).toContain(`Names: ${percent(all.found, all.labelled)} of test names are removed, and at least ${Math.round(weakest * 100)}% in every one of ${groups.length} name-origin groups.`)
  })

  it('has the analysis accuracy of the published test runs in results.json', () => {
    const results = JSON.parse(readFileSync('data/eval/analysis/results.json', 'utf8')) as AnalysisResults
    const published = results.runs.filter(run => run.split === 'test' && run.scores?.tags)
    expect(published.length).toBeGreaterThan(0)
    const add = (pick: (run: typeof published[number]) => { hits: number, of: number }) => published.reduce((total, run) => ({ hits: total.hits + pick(run).hits, of: total.of + pick(run).of }), { hits: 0, of: 0 })
    const ofRate = (rate: { hits: number, of: number }) => percent(rate.hits, rate.of)
    const found = (kind: 'jobs' | 'pains' | 'gains') => ofRate(add(run => run.scores!.tags![kind].recall))
    const correct = (kind: 'jobs' | 'pains' | 'gains') => ofRate(add(run => run.scores!.tags![kind].precision))
    expect(text).toContain(`${found('jobs')} of jobs, ${found('pains')} of pains and ${found('gains')} of gains are found`)
    expect(text).toContain(`of what is reported, ${correct('jobs')}, ${correct('pains')} and ${correct('gains')} match the labels`)
    const quotes = add(run => run.quotes)
    expect(text).toContain(`${percent(quotes.hits, quotes.of)} of quotes were found word for word`)
  })

  it('says how the analysis texts were made, word for word as on the Accuracy page, with the weakness that follows', () => {
    const page = JSON.parse(readFileSync('i18n/locales/en/accuracy.json', 'utf8')) as { accuracy: { analysis: { source: string, weaknesses: { items: string[] } } } }
    expect(text).toContain(page.accuracy.analysis.source)
    expect(text).toContain(page.accuracy.analysis.weaknesses.items.find(item => item.startsWith('The texts are synthetic'))!)
    expect(text).toContain('Claude Opus 5.5')
  })

  it('lists every roadmap item with its status, version, release date and link', () => {
    const status = { released: 'Released', inProgress: 'In progress', planned: 'Planned', idea: 'Idea' }
    for (const item of ROADMAP_ITEMS) {
      const name = sources.items[item.id]!.name
      const line = text.split('\n').find(row => row.includes(`: ${name}: `))
      expect(line, item.id).toBeDefined()
      expect(line).toContain(status[item.status])
      expect(line).toContain(item.link.url)
      if (item.version) expect(line).toContain(item.version)
      if (item.released) expect(line).toContain(item.released)
    }
  })

  it('has the privacy sections of docs/privacy.md word for word', () => {
    const doc = readFileSync('docs/privacy.md', 'utf8')
    expect(text).toContain(privacySection(doc, 'Privacy'))
    expect(text).toContain(privacySection(doc, 'What is stored in your browser'))
    expect(text).toContain(privacySection(doc, "What Painfold doesn't protect against"))
    // Only links are rewritten: relative links become links to the repository.
    expect(privacySection(doc, 'Privacy')).not.toMatch(/\]\((?!https?:)/)
  })
})
