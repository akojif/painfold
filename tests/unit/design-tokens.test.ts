import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

const css = readFileSync(new URL('../../app/assets/css/main.css', import.meta.url), 'utf8')

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
const themeStart = css.indexOf('@theme')

function readTokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--pf-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)].map(([, name, value]) => [name!, value!]),
  )
}

const themes = {
  light: readTokens(css.slice(0, darkStart)),
  dark: readTokens(css.slice(darkStart, themeStart)),
}

// Sheets of paper on the night desk set the --color-* roles directly.
const paperStart = css.indexOf('.paper {', darkStart)
const paper = Object.fromEntries(
  [...css.slice(paperStart, css.indexOf('}', paperStart)).matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)].map(([, name, value]) => [name!, value!]),
)

// Text must reach 4.5:1 (WCAG 1.4.3). Borders of controls and focus
// indicators must reach 3:1 against what they sit on (WCAG 1.4.11).
const TEXT = 4.5
const NON_TEXT = 3

const pairs: Array<[foreground: string, background: string, minimum: number]> = [
  ['ink', 'desk', TEXT],
  ['ink', 'sheet', TEXT],
  ['ink-muted', 'desk', TEXT],
  ['ink-muted', 'sheet', TEXT],
  ['signal', 'desk', TEXT],
  ['signal', 'sheet', TEXT],
  ['alert', 'desk', TEXT],
  ['alert', 'sheet', TEXT],
  ['on-signal', 'signal', TEXT],
  ['on-highlighter', 'highlighter', TEXT],
  ['on-redaction', 'redaction', TEXT],
  ['rule-strong', 'desk', NON_TEXT],
  ['rule-strong', 'sheet', NON_TEXT],
]

describe('design tokens', () => {
  it('define the same colour roles in light and dark', () => {
    expect(Object.keys(themes.light).length).toBeGreaterThan(0)
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort())
  })

  it('map every Tailwind colour to a defined role', () => {
    const mapped = [...css.slice(themeStart).matchAll(/--color-[a-z-]+:\s*var\(--pf-([a-z-]+)\)/g)].map(([, name]) => name!)
    expect(mapped.length).toBeGreaterThan(0)
    for (const name of mapped) expect(themes.light, name).toHaveProperty(name)
  })

  it('keep sheets of paper readable on the night desk', () => {
    expect(paperStart).toBeGreaterThan(darkStart)
    for (const [foreground, background] of [['ink', 'sheet'], ['ink-muted', 'sheet'], ['signal', 'sheet'], ['on-signal', 'signal'], ['on-highlighter', 'highlighter'], ['on-redaction', 'redaction']]) {
      const ratio = contrastRatio(paper[foreground!]!, paper[background!]!)
      expect(ratio, `${foreground} on ${background} (paper) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT)
    }
    expect(contrastRatio(paper['rule-strong']!, paper.sheet!)).toBeGreaterThanOrEqual(NON_TEXT)
  })

  for (const [themeName, tokens] of Object.entries(themes)) {
    describe(`${themeName} theme`, () => {
      it.each(pairs)('%s on %s reaches %d:1', (foreground, background, minimum) => {
        const ratio = contrastRatio(tokens[foreground]!, tokens[background]!)
        expect(ratio, `${foreground} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum)
      })
    })
  }
})
