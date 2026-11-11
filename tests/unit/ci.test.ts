import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The browser tests run in Microsoft's Playwright image (.github/workflows/ci.yml),
// which brings its own Chromium. A different Playwright version would look for a
// browser the image does not have, so a version bump must change both together.
describe('CI', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const { version } = JSON.parse(readFileSync(new URL('../../node_modules/@playwright/test/package.json', import.meta.url), 'utf8')) as { version: string }

  it('runs the browser tests in the Playwright image of the installed version, pinned by digest', () => {
    const images = [...workflow.matchAll(/image: mcr\.microsoft\.com\/playwright:(\S+)/g)].map(match => match[1])
    expect(images).toHaveLength(2)
    for (const image of images) expect(image).toMatch(new RegExp(`^v${version.replaceAll('.', '\\.')}-\\w+@sha256:[0-9a-f]{64}$`))
  })

  it('installs nothing from Ubuntu\'s package servers', () => {
    expect(workflow).not.toContain('--with-deps')
    expect(workflow).not.toMatch(/apt(-get)? install/)
  })
})
