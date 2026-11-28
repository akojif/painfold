// Themes (Stage 3, slice 5, #127): every number in the report is counted here,
// in code, from the tagged texts and the merged themes. The AI only said which
// labels belong together; it never gives a count, a share or an intensity.
import { KINDS, labelKey, type Kind, type MergedTheme } from './merge.ts'
import { SENTIMENTS, TYPES, type TaggedText } from './tagging.ts'

// A theme found in fewer items than this is marked low confidence.
export const LOW_CONFIDENCE_BELOW = 5

export type Quote = { item: string, quote: string, intensity: 1 | 2 | 3 }

export type Theme = {
  kind: Kind
  name: string
  /** The labels merged into this theme, as the AI wrote them in the texts. */
  labels: string[]
  /** The items with this theme, in their order in the file. */
  items: string[]
  /** Items with this theme, each counted once. */
  count: number
  /** Count ÷ texts analysed. */
  share: number
  /** The mean, over its items, of each item's strongest intensity in this theme: 1 (mild) to 3 (strong). */
  intensity: number
  confidence: 'low' | 'enough'
  /** Verified quotes, one per item, strongest first, no repeats: the report picks from the top. */
  quotes: Quote[]
  sentiment: Record<typeof SENTIMENTS[number], number>
  types: Record<typeof TYPES[number], number>
}

/**
 * Counts each kind's themes from the tagged texts. `itemOf` maps the short ids
 * back to the items. A label in no merged theme becomes a theme of its own, so
 * every tag is counted. Themes are ranked by items, then intensity, then name.
 */
export function countThemes(tagged: ReadonlyMap<string, TaggedText>, merged: Partial<Record<Kind, readonly MergedTheme[]>>, itemOf: ReadonlyMap<string, string>): Record<Kind, Theme[]> {
  const analysed = tagged.size
  const counted = {} as Record<Kind, Theme[]>
  for (const kind of KINDS) {
    const themeOf = new Map<string, number>()
    const themes: Array<{ name: string, labels: Set<string> }> = []
    for (const theme of merged[kind] ?? []) {
      for (const key of theme.labels) if (!themeOf.has(key)) themeOf.set(key, themes.length)
      themes.push({ name: theme.name, labels: new Set() })
    }
    // Per theme: each item's strongest intensity and best quote.
    const perTheme = themes.map(() => new Map<string, { text: TaggedText, intensity: 1 | 2 | 3, quote?: string }>())
    for (const text of tagged.values()) {
      for (const tag of text[kind]) {
        const key = labelKey(tag.label)
        if (!themeOf.has(key)) {
          themeOf.set(key, themes.length)
          themes.push({ name: tag.label, labels: new Set() })
          perTheme.push(new Map())
        }
        const index = themeOf.get(key)!
        themes[index]!.labels.add(tag.label)
        const seen = perTheme[index]!.get(text.id)
        if (!seen || tag.intensity > seen.intensity || (tag.intensity === seen.intensity && !seen.quote && tag.quote)) {
          perTheme[index]!.set(text.id, { text, intensity: tag.intensity, quote: tag.quote ?? seen?.quote })
        }
      }
    }
    counted[kind] = themes
      .map((theme, index): Theme | undefined => {
        // In file order: answers arrive in any order, short ids follow the file.
        const entries = [...perTheme[index]!.values()].sort((a, b) => Number(a.text.id.slice(1)) - Number(b.text.id.slice(1)))
        if (entries.length === 0) return undefined
        const sentiment = Object.fromEntries(SENTIMENTS.map(value => [value, 0])) as Theme['sentiment']
        const types = Object.fromEntries(TYPES.map(value => [value, 0])) as Theme['types']
        for (const { text } of entries) {
          sentiment[text.sentiment]++
          types[text.type]++
        }
        const seenQuotes = new Set<string>()
        const quotes = entries
          .filter(entry => entry.quote)
          .sort((a, b) => b.intensity - a.intensity)
          .filter(entry => !seenQuotes.has(entry.quote!.toLowerCase()) && seenQuotes.add(entry.quote!.toLowerCase()))
          .map(entry => ({ item: itemOf.get(entry.text.id) ?? entry.text.id, quote: entry.quote!, intensity: entry.intensity }))
        return {
          kind,
          name: theme.name,
          labels: [...theme.labels],
          items: entries.map(entry => itemOf.get(entry.text.id) ?? entry.text.id),
          count: entries.length,
          share: analysed === 0 ? 0 : entries.length / analysed,
          intensity: entries.reduce((sum, entry) => sum + entry.intensity, 0) / entries.length,
          confidence: entries.length < LOW_CONFIDENCE_BELOW ? 'low' : 'enough',
          quotes,
          sentiment,
          types,
        }
      })
      .filter((theme): theme is Theme => theme !== undefined)
      .sort((a, b) => b.count - a.count || b.intensity - a.intensity || a.name.localeCompare(b.name))
  }
  return counted
}
