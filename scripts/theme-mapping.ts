// The theme mapping for the analysis evaluation's final test run (#129): a
// person maps each theme the model found to a gold theme, or to none, so
// tag-level recall and precision can be counted in code. One spreadsheet per
// language: Francis maps English, the German labeller maps German, and the
// sheet records who mapped it. Written with SheetJS (no dropdowns), so the
// reader below checks every row instead: a typo is reported, never guessed.
import { utils, type WorkBook } from 'xlsx'
import { KINDS, type Kind } from '../core/ai/merge.ts'
import type { Theme } from '../core/ai/themes.ts'
import type { ThemeMapping } from './analysis-metrics.ts'
import type { Finding, ItemLabels } from './labels.ts'

export const MAPPING_FORMAT = 'painfold-theme-mapping/1'
export const MAPPINGS_DIR = 'data/eval/analysis/mappings'

/** A mapping as stored next to its run (mappings/<run file>). */
export type StoredMapping = {
  format: typeof MAPPING_FORMAT
  run: string
  lang: 'en' | 'de'
  /** Who mapped this language, as they wrote it in the sheet. */
  mappedBy: string
  mapping: ThemeMapping
}

/** One model theme to map: its kind, name, how many texts it covers and up to two quotes. */
export type MappingRow = { kind: Kind, theme: string, texts: number, quotes: string[] }

const TEXT = {
  en: {
    guide: 'Guidelines', mapping: 'Mapping', gold: 'Gold themes',
    mappedBy: 'Mapped by', run: 'Run', none: 'none',
    header: ['kind', 'model theme', 'texts', 'example quotes', 'gold theme', 'comment'],
    goldHeader: ['kind', 'gold theme'],
    kinds: { jobs: 'job', pains: 'pain', gains: 'gain' } as Record<Kind, string>,
    lines: [
      'Mapping the model\'s themes to the gold themes',
      'Each row on the Mapping tab is a theme the model found in the test split, with how many texts it covers and two example quotes.',
      'In the "gold theme" column, write the gold theme of the same kind that means the same thing, copied exactly from the Gold themes tab. If none fits, write: none.',
      'Map by meaning, not wording: "Bank connection drops" and "Bank feed disconnects" are the same pain. If a model theme mixes two gold themes, choose the one that fits most of its quotes and add a comment.',
      'Write your name in the cell next to "Mapped by" on the Mapping tab. Do not change the kind, model theme, texts or quotes columns, and do not add or delete rows.',
      'When you are done, save the file as .xlsx and send it back.',
    ],
  },
  de: {
    guide: 'Anleitung', mapping: 'Zuordnung', gold: 'Gold-Themen',
    mappedBy: 'Zugeordnet von', run: 'Lauf', none: 'keins',
    header: ['Art', 'Modell-Thema', 'Texte', 'Beispielzitate', 'Gold-Thema', 'Kommentar'],
    goldHeader: ['Art', 'Gold-Thema'],
    kinds: { jobs: 'Job', pains: 'Pain', gains: 'Gain' } as Record<Kind, string>,
    lines: [
      'Die Themen des Modells den Gold-Themen zuordnen',
      'Jede Zeile auf dem Tab Zuordnung ist ein Thema, das das Modell im Test-Teil gefunden hat, mit der Zahl der Texte und zwei Beispielzitaten.',
      'In die Spalte „Gold-Thema“ das Gold-Thema derselben Art schreiben, das dasselbe meint, genau so wie auf dem Tab Gold-Themen. Wenn keines passt: keins.',
      'Nach Bedeutung zuordnen, nicht nach Wortlaut: „Bankverbindung bricht ab“ und „Bank-Feed trennt sich“ sind dasselbe Pain. Wenn ein Modell-Thema zwei Gold-Themen mischt, das wählen, das zu den meisten Zitaten passt, und einen Kommentar schreiben.',
      'Den eigenen Namen in die Zelle neben „Zugeordnet von“ auf dem Tab Zuordnung schreiben. Die Spalten Art, Modell-Thema, Texte und Beispielzitate nicht ändern und keine Zeilen hinzufügen oder löschen.',
      'Zum Schluss als .xlsx speichern und zurückschicken.',
    ],
  },
} as const

const sameName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de').normalize('NFC')

/** The rows to map: every model theme of each kind, most texts first, each name once. */
export function mappingRows(themes: Record<Kind, readonly Theme[]>): MappingRow[] {
  return KINDS.flatMap((kind) => {
    const seen = new Set<string>()
    return themes[kind].filter(theme => !seen.has(theme.name) && seen.add(theme.name))
      .map(theme => ({ kind, theme: theme.name, texts: theme.count, quotes: theme.quotes.slice(0, 2).map(quote => quote.quote) }))
  })
}

/** The gold themes of each kind in these labels, sorted. */
export function goldNames(labels: readonly ItemLabels[]): Record<Kind, string[]> {
  return Object.fromEntries(KINDS.map(kind => [kind, [...new Set(labels.flatMap(label => label[kind]))].sort((a, b) => a.localeCompare(b))])) as Record<Kind, string[]>
}

/** The spreadsheet for one run, in its language. */
export function mappingWorkbook(run: string, lang: 'en' | 'de', rows: readonly MappingRow[], gold: Record<Kind, readonly string[]>): WorkBook {
  const text = TEXT[lang]
  const book = utils.book_new()
  const guide = utils.aoa_to_sheet(text.lines.map(line => [line]))
  guide['!cols'] = [{ wch: 120 }]
  utils.book_append_sheet(book, guide, text.guide)
  const mapping = utils.aoa_to_sheet([
    [text.mappedBy, ''],
    [text.run, run],
    [],
    [...text.header],
    ...rows.map(row => [text.kinds[row.kind], row.theme, row.texts, row.quotes.map(quote => `“${quote}”`).join('\n'), '', '']),
  ])
  mapping['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 7 }, { wch: 60 }, { wch: 40 }, { wch: 30 }]
  utils.book_append_sheet(book, mapping, text.mapping)
  const goldSheet = utils.aoa_to_sheet([[...text.goldHeader], ...KINDS.flatMap(kind => gold[kind].map(name => [text.kinds[kind], name]))])
  goldSheet['!cols'] = [{ wch: 10 }, { wch: 50 }]
  utils.book_append_sheet(book, goldSheet, text.gold)
  return book
}

/**
 * Reads a filled sheet back. Every model theme must be there, unchanged, with
 * a gold theme of its kind or "none"; "Mapped by" must be filled in. Returns
 * the mapping only when there are no problems.
 */
export function readMapping(book: WorkBook, run: string, lang: 'en' | 'de', rows: readonly MappingRow[], gold: Record<Kind, readonly string[]>): { stored?: StoredMapping, findings: Finding[] } {
  const text = TEXT[lang]
  const findings: Finding[] = []
  const problem = (where: string, message: string) => findings.push({ level: 'problem', where, message })
  const sheet = book.Sheets[text.mapping]
  if (!sheet) return { findings: [{ level: 'problem', where: 'file', message: `needs the tab ${text.mapping}` }] }
  const cells = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  const mappedBy = String(cells[0]?.[1] ?? '').trim()
  if (!mappedBy) problem(`${text.mapping}, B1`, `write who mapped this language next to "${text.mappedBy}"`)
  if (String(cells[1]?.[1] ?? '').trim() !== run) problem(`${text.mapping}, B2`, `this sheet is for the run ${String(cells[1]?.[1] ?? '')}, not ${run}`)

  const kindOf = new Map(KINDS.map(kind => [sameName(text.kinds[kind]), kind]))
  const goldByKind = new Map(KINDS.map(kind => [kind, new Map(gold[kind].map(name => [sameName(name), name]))]))
  const expected = new Map(rows.map(row => [`${row.kind}|${row.theme}`, row]))
  const mapping = Object.fromEntries(KINDS.map(kind => [kind, {}])) as ThemeMapping
  const done = new Set<string>()
  for (const [index, row] of cells.slice(4).entries()) {
    const [kindCell = '', theme = '', , , goldCell = ''] = row.map(cell => String(cell ?? '').trim())
    if (!kindCell && !theme && !goldCell) continue
    const where = `${text.mapping}, row ${index + 5}`
    const kind = kindOf.get(sameName(kindCell))
    const key = `${kind}|${theme}`
    if (!kind || !expected.has(key)) {
      problem(where, `"${kindCell} ${theme}" is not a model theme of this run; do not change or add rows`)
      continue
    }
    if (done.has(key)) {
      problem(where, 'this model theme appears twice')
      continue
    }
    done.add(key)
    if (!goldCell) problem(where, `write a gold theme for "${theme}", or ${text.none}`)
    else if (sameName(goldCell) === text.none || sameName(goldCell) === 'none') mapping[kind][theme] = null
    else {
      const name = goldByKind.get(kind)!.get(sameName(goldCell))
      if (name) mapping[kind][theme] = name
      else problem(where, `"${goldCell}" is not a gold ${text.kinds[kind]} theme; copy it from the ${text.gold} tab, or write ${text.none}`)
    }
  }
  for (const [key, row] of expected) if (!done.has(key)) problem(text.mapping, `the row for "${row.theme}" is missing`)
  if (findings.length > 0) return { findings }
  return { stored: { format: MAPPING_FORMAT, run, lang, mappedBy, mapping }, findings }
}
