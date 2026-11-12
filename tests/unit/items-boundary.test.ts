import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// After the column step, everything works on feedback items (#86). Only the
// import side (the column step, core/import, core/columns), the table adapter
// (core/items/table.ts, with the locations in core/items/types.ts) and the
// CSV export know about rows and columns. This test reads the code after that
// boundary, without comments and strings, and fails if it names a row or a
// column.
const root = new URL('../../', import.meta.url)
const inFolder = (folder: string) => readdirSync(new URL(folder, root), { recursive: true, encoding: 'utf8' })
  .filter(file => /\.(ts|vue)$/.test(file))
  .map(file => `${folder}${file}`)

const AFTER_THE_BOUNDARY = [
  ...inFolder('core/review/'),
  ...inFolder('core/detect/'),
  ...inFolder('core/redact/'),
  'core/export/report.ts',
  'app/pages/review.vue',
  'app/components/ReviewUnit.vue',
  'app/components/MarginNote.vue',
  'app/components/ValueList.vue',
  'app/components/FindingMark.vue',
  'app/components/WarningMark.vue',
  'app/composables/useNameScan.ts',
  'app/utils/selection.ts',
  'app/utils/value-list.ts',
]

/** The code without comments and without the contents of strings and templates' text. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '\'\'')
}

describe('rows and columns stay behind the import boundary', () => {
  it('lists real files', () => {
    expect(AFTER_THE_BOUNDARY.length).toBeGreaterThan(20)
  })

  for (const file of AFTER_THE_BOUNDARY) {
    it(file, () => {
      const lines = codeOf(readFileSync(new URL(file, root), 'utf8')).split('\n')
      const found = lines.flatMap((line, index) => (/\b(?:row|rows|column|columns)\b/.test(line) ? [`${index + 1}: ${line.trim()}`] : []))
      expect(found).toEqual([])
    })
  }

  it('catches a row or column in code, but not in comments or strings', () => {
    expect(codeOf('const x = finding.row // a row\nconst y = \'column\'')).toMatch(/\brow\b/)
    expect(codeOf('// row and column\nconst label = \'Row 17\'')).not.toMatch(/\b(?:row|column)\b/i)
  })
})
