// Converts a filled labelling spreadsheet (#129) into the analysis evaluation
// format and reports anything missing or invalid.
//
//   npm run labels:convert -- path/to/labelling-en.xlsx [more files]
//
// For each file: reads the items and themes tabs (English or German names),
// checks every row against data/eval/analysis/items.jsonl (scripts/labels.ts),
// prints every problem with its row, and only when there are none writes
// data/eval/analysis/labels-<lang>.jsonl. Notes (such as theme names no item
// uses) are printed but do not stop the conversion.
import { readFileSync, writeFileSync } from 'node:fs'
import { read, utils } from 'xlsx'
import { checkLabels, type LabelItem } from './labels.ts'

const ITEMS_PATH = 'data/eval/analysis/items.jsonl'
const SHEETS = { items: ['Items', 'Einträge'], themes: ['Themes', 'Themen'] }

const items = readFileSync(ITEMS_PATH, 'utf8').trim().split('\n').map(line => JSON.parse(line) as LabelItem)
const files = process.argv.slice(2).filter(argument => argument !== '--')
if (files.length === 0) {
  console.error('Usage: npm run labels:convert -- labelling-en.xlsx [labelling-de.xlsx]')
  process.exit(2)
}

let failed = false
for (const file of files) {
  const book = read(readFileSync(file))
  const sheet = (names: string[]) => names.map(name => book.Sheets[name]).find(Boolean)
  const itemSheet = sheet(SHEETS.items)
  const themeSheet = sheet(SHEETS.themes)
  if (!itemSheet || !themeSheet) {
    console.error(`${file}: needs the tabs ${SHEETS.items.join(' or ')} and ${SHEETS.themes.join(' or ')}`)
    failed = true
    continue
  }
  // Rows as text, without the header row.
  const rows = (target: typeof itemSheet) => utils.sheet_to_json<string[]>(target, { header: 1, raw: false, defval: '' }).slice(1)
  const itemRows = rows(itemSheet)
  const firstId = itemRows.find(row => row[0])?.[0] ?? ''
  const lang = firstId.startsWith('de-') ? 'de' : 'en'
  const { labels, findings } = checkLabels(items.filter(item => item.lang === lang), itemRows, rows(themeSheet))

  const problems = findings.filter(finding => finding.level === 'problem')
  console.log(`${file} (${lang}): ${labels.length} rows read, ${problems.length} problem${problems.length === 1 ? '' : 's'}`)
  for (const { level, where, message } of findings) console.log(`  ${level === 'problem' ? 'Problem' : 'Note'}  ${where}: ${message}`)
  if (problems.length > 0) {
    failed = true
    continue
  }
  const out = `data/eval/analysis/labels-${lang}.jsonl`
  writeFileSync(out, labels.map(label => JSON.stringify(label)).join('\n') + '\n')
  console.log(`  Wrote ${out}`)
}
process.exit(failed ? 1 : 0)
