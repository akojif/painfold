// The first report (Stage 3, slice 6, #128): how the counted themes are laid
// out. Nothing here is counted anew; it only orders, splits and scales what
// themes.ts counted, so the page stays a plain view of those numbers.
import { KINDS, type Kind } from './merge.ts'
import { LOW_CONFIDENCE_BELOW, type Theme } from './themes.ts'

/** Quotes shown per theme. */
export const QUOTES_SHOWN = 3

export type Intensity = 'mild' | 'moderate' | 'strong'

/** A theme's mean intensity (1 to 3) in words: under 1.5 mild, under 2.5 moderate, else strong. */
export function intensityLevel(mean: number): Intensity {
  if (mean < 1.5) return 'mild'
  if (mean < 2.5) return 'moderate'
  return 'strong'
}

export type ReportSection = {
  kind: Kind
  /** Themes found in at least LOW_CONFIDENCE_BELOW items, ranked. */
  main: Theme[]
  /** Themes found in fewer items, ranked: listed by name and count only. */
  few: Theme[]
}

export type Report = {
  sections: ReportSection[]
  /** The largest share in the whole report: every bar is scaled to it, so bars compare across jobs, pains and gains. */
  largestShare: number
}

export function reportOf(themes: Record<Kind, readonly Theme[]>): Report {
  const sections = KINDS.map(kind => ({
    kind,
    main: themes[kind].filter(theme => theme.count >= LOW_CONFIDENCE_BELOW),
    few: themes[kind].filter(theme => theme.count < LOW_CONFIDENCE_BELOW),
  }))
  const largestShare = Math.max(0, ...KINDS.flatMap(kind => themes[kind].map(theme => theme.share)))
  return { sections, largestShare }
}

/** A bar's length between 0 and 1: the theme's share against the largest in the report. */
export const barLength = (share: number, largestShare: number) => (largestShare > 0 ? Math.min(1, share / largestShare) : 0)

export type QuotePart = { text: string, placeholder: boolean }

/** A quote cut into plain text and placeholders such as [NAME_1], so placeholders can be shown as tokens. */
export function quoteParts(quote: string): QuotePart[] {
  const parts: QuotePart[] = []
  let last = 0
  for (const match of quote.matchAll(/\[[A-Z_]+_\d+\]/g)) {
    if (match.index > last) parts.push({ text: quote.slice(last, match.index), placeholder: false })
    parts.push({ text: match[0], placeholder: true })
    last = match.index + match[0].length
  }
  if (last < quote.length) parts.push({ text: quote.slice(last), placeholder: false })
  return parts
}
