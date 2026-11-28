// Turns the rows of a filled labelling spreadsheet (#129) into the evaluation
// format, and finds what is missing or invalid. Plain code, so it is tested
// without files: scripts/convert-labels.ts reads the XLSX and writes the result.

export const SENTIMENTS = ['positive', 'negative', 'mixed', 'neutral'] as const
export const TYPES = ['bug', 'feature request', 'question', 'praise', 'complaint', 'other'] as const
export const KINDS = ['job', 'pain', 'gain'] as const

export type Sentiment = typeof SENTIMENTS[number]
export type FeedbackType = typeof TYPES[number]
export type Kind = typeof KINDS[number]

export type LabelItem = { id: string, lang: 'en' | 'de', split: 'dev' | 'test', text: string }

/** One labelled item, as the analysis evaluation reads it. */
export type ItemLabels = {
  id: string
  lang: 'en' | 'de'
  split: 'dev' | 'test'
  jobs: string[]
  pains: string[]
  gains: string[]
  sentiment: Sentiment
  type: FeedbackType
  comment?: string
}

/** A problem stops the conversion; a note is only reported. */
export type Finding = { level: 'problem' | 'note', where: string, message: string }

/** Several names in one cell: separated by semicolons or line breaks. */
export function splitNames(cell: string): string[] {
  return cell.split(/[;\n\r]+/).map(name => name.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

const sameName = (name: string) => name.toLocaleLowerCase('de').normalize('NFC')

/**
 * Checks the item rows (id, text, jobs, pains, gains, sentiment, type,
 * comment) and the theme rows (kind, name, note) of one language against the
 * items that were handed out.
 */
export function checkLabels(items: readonly LabelItem[], itemRows: readonly (readonly string[])[], themeRows: readonly (readonly string[])[]): { labels: ItemLabels[], findings: Finding[] } {
  const findings: Finding[] = []
  const problem = (where: string, message: string) => findings.push({ level: 'problem', where, message })
  const note = (where: string, message: string) => findings.push({ level: 'note', where, message })

  // The themes tab: every name used in the items must be listed, under its kind.
  // Names are compared without case, and written as on the themes tab.
  const themes = new Map<string, Map<string, string>>(KINDS.map(kind => [kind, new Map()]))
  for (const [index, row] of themeRows.entries()) {
    const [kind = '', name = ''] = row.map(cell => cell.trim())
    if (!kind && !name) continue
    const where = `themes, row ${index + 2}`
    if (!(KINDS as readonly string[]).includes(kind)) problem(where, `kind "${kind}" must be one of: ${KINDS.join(', ')}`)
    else if (!name) problem(where, 'a kind without a name')
    else themes.get(kind)!.set(sameName(name), name.replace(/\s+/g, ' '))
  }

  const expected = new Map(items.map(item => [item.id, item]))
  const seen = new Set<string>()
  const used = new Map<string, Set<string>>(KINDS.map(kind => [kind, new Set()]))
  const labels: ItemLabels[] = []

  for (const [index, row] of itemRows.entries()) {
    const [id = '', text = '', jobs = '', pains = '', gains = '', sentiment = '', type = '', comment = ''] = row.map(cell => cell ?? '')
    if (![id, text, jobs, pains, gains, sentiment, type, comment].some(cell => cell.trim())) continue
    const where = `row ${index + 2}${id ? ` (${id})` : ''}`
    const item = expected.get(id.trim())
    if (!item) {
      problem(where, `unknown id "${id}"`)
      continue
    }
    if (seen.has(item.id)) {
      problem(where, 'this id appears twice')
      continue
    }
    seen.add(item.id)
    if (text.trim() !== item.text.trim()) problem(where, 'the text was changed; it must stay as handed out')

    const names: Record<Kind, string[]> = { job: [], pain: [], gain: [] }
    const cells: Record<Kind, string> = { job: jobs, pain: pains, gain: gains }
    for (const kind of KINDS) {
      for (const name of splitNames(cells[kind])) {
        if (/\[[A-Z_]+_\d+\]/.test(name)) problem(where, `${kind} "${name}" contains a placeholder`)
        const listed = themes.get(kind)!.get(sameName(name))
        if (!listed) {
          problem(where, `${kind} "${name}" is not on the themes tab as a ${kind}`)
          continue
        }
        used.get(kind)!.add(sameName(name))
        // The same name twice in one cell counts once.
        if (!names[kind].includes(listed)) names[kind].push(listed)
      }
    }

    const cleanSentiment = sentiment.trim().toLowerCase()
    const cleanType = type.trim().toLowerCase()
    if (!cleanSentiment) problem(where, 'sentiment is missing')
    else if (!(SENTIMENTS as readonly string[]).includes(cleanSentiment)) problem(where, `sentiment "${sentiment}" must be one of: ${SENTIMENTS.join(', ')}`)
    if (!cleanType) problem(where, 'type is missing')
    else if (!(TYPES as readonly string[]).includes(cleanType)) problem(where, `type "${type}" must be one of: ${TYPES.join(', ')}`)

    labels.push({
      id: item.id,
      lang: item.lang,
      split: item.split,
      jobs: names.job,
      pains: names.pain,
      gains: names.gain,
      sentiment: cleanSentiment as Sentiment,
      type: cleanType as FeedbackType,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    })
  }

  for (const item of items) if (!seen.has(item.id)) problem(item.id, 'this item is missing from the sheet')
  for (const kind of KINDS) {
    const unused = [...themes.get(kind)!].filter(([key]) => !used.get(kind)!.has(key)).map(([, name]) => name)
    if (unused.length > 0) note('themes', `${kind} names on the themes tab that no item uses: ${unused.join(', ')}`)
  }
  return { labels: labels.sort((a, b) => a.id.localeCompare(b.id)), findings }
}
