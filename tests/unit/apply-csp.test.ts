import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { externalReferences, inlineScriptHashes, styleAttributes, withPolicyMeta } from '../../scripts/apply-csp'

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('base64')

describe('inlineScriptHashes', () => {
  it('hashes classic and import map inline scripts', () => {
    const html = '<script>window.a=1</script><script type="importmap">{"imports":{}}</script>'
    expect(inlineScriptHashes(html)).toEqual([sha256('window.a=1'), sha256('{"imports":{}}')])
  })

  it('skips external scripts and JSON data blocks, which never execute inline', () => {
    const html = '<script type="module" src="/_nuxt/a.js"></script>'
      + '<script type="application/json" id="__NUXT_DATA__">[1]</script>'
      + '<script type="application/ld+json">{}</script>'
    expect(inlineScriptHashes(html)).toEqual([])
  })
})

describe('externalReferences', () => {
  it('finds references to other origins in markup and CSS', () => {
    const text = '<script src="https://cdn.example.com/a.js"></script>'
      + '<link href="//fonts.example.com/f.css">'
      + '@font-face{src:url(https://fonts.example.com/f.woff2)}'
      + '@import "https://example.com/x.css";'
    expect(externalReferences(text)).toEqual([
      'https://cdn.example.com/a.js',
      '//fonts.example.com/f.css',
      'https://fonts.example.com/f.woff2',
      'https://example.com/x.css',
    ])
  })

  it('allows ordinary links, which load nothing until followed', () => {
    expect(externalReferences('<a href="https://github.com/akojif/painfold" class="x">Source code</a>')).toEqual([])
  })

  it('still finds other-origin references on tags that load by themselves', () => {
    expect(externalReferences('<iframe src="https://example.com/embed"></iframe><img srcset="https://example.com/a.png 2x">')).toEqual([
      'https://example.com/embed',
      'https://example.com/a.png',
    ])
  })

  it('ignores the app\'s own files and data URLs', () => {
    expect(externalReferences('<script src="/_nuxt/a.js"></script><img src="data:image/png;base64,AA">url(../fonts/a.woff2)')).toEqual([])
  })
})

describe('styleAttributes', () => {
  it('finds style attributes, including the empty one Vue renders for an undefined binding', () => {
    expect(styleAttributes('<span class="a" style="">x</span><div style="width: 2px">')).toHaveLength(2)
  })

  it('ignores the word style elsewhere', () => {
    expect(styleAttributes('<p class="style">style="x" in text</p><link rel="stylesheet" href="/a.css">')).toEqual([])
  })
})

describe('withPolicyMeta', () => {
  const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><script>x()</script></head></html>'

  it('places the policy before any script', () => {
    const result = withPolicyMeta(page, "default-src 'none'")
    expect(result.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(result.indexOf('<script>'))
    expect(result.indexOf('<meta charset')).toBeLessThan(result.indexOf('http-equiv'))
  })

  it('refuses to add a second policy', () => {
    expect(() => withPolicyMeta(withPolicyMeta(page, 'a'), 'b')).toThrow()
  })
})
