import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

const css = readFileSync(new URL('../../app/assets/css/main.css', import.meta.url), 'utf8')

function readTheme(name: 'light' | 'dark'): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(new RegExp(`--pf-${name}-([a-z-]+):\\s*(#[0-9a-fA-F]{6});`, 'g'))].map(([, role, value]) => [role!, value!]),
  )
}

const themes = { light: readTheme('light'), dark: readTheme('dark') }

// Text must reach 4.5:1 (WCAG 1.4.3). Control borders, focus rings and the
// pending underline must reach 3:1 against what they sit on (WCAG 1.4.11).
const TEXT = 4.5
const NON_TEXT = 3

const pairs: Array<[foreground: string, background: string, minimum: number]> = [
  ['fg', 'canvas', TEXT],
  ['fg', 'surface', TEXT],
  ['fg-muted', 'canvas', TEXT],
  ['fg-muted', 'surface', TEXT],
  ['accent', 'canvas', TEXT],
  ['accent', 'surface', TEXT],
  ['on-accent', 'accent', TEXT],
  ['on-danger', 'danger', TEXT],
  ['danger', 'canvas', TEXT],
  ['danger', 'surface', TEXT],
  ['on-pending', 'pending', TEXT],
  ['on-token', 'token', TEXT],
  ['line-strong', 'canvas', NON_TEXT],
  ['line-strong', 'surface', NON_TEXT],
  ['pending-line', 'pending', NON_TEXT],
  ['pending-line', 'canvas', NON_TEXT],
  ['token', 'canvas', NON_TEXT],
]

describe('design tokens', () => {
  it('define the same colour roles in light and dark', () => {
    expect(Object.keys(themes.light).length).toBeGreaterThan(10)
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort())
  })

  it('use the dark page colours agreed for the design pass', () => {
    expect(themes.dark).toMatchObject({ 'canvas': '#11161F', 'surface': '#161C27', 'line': '#232B38', 'fg': '#E6EAF0', 'fg-muted': '#94A0B0' })
  })

  it('map every Tailwind colour to a defined role', () => {
    const themeStart = css.indexOf('@theme')
    const mapped = [...css.slice(themeStart).matchAll(/--color-[a-z-]+:\s*var\(--pf-([a-z-]+)\)/g)].map(([, name]) => name!)
    expect(mapped.length).toBeGreaterThan(10)
    for (const name of mapped) expect(themes.light, name).toHaveProperty(name)
  })

  it('switch every role in both dark selectors', () => {
    const roles = Object.keys(themes.light)
    for (const selector of [':root:not([data-theme="light"])', ':root[data-theme="dark"]']) {
      const start = css.indexOf(`${selector} {`)
      const block = css.slice(start, css.indexOf('}', start))
      for (const role of roles) expect(block, `${selector} ${role}`).toContain(`--pf-${role}: var(--pf-dark-${role});`)
    }
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
