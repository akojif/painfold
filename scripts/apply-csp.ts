// Runs after `nuxt generate`. For every HTML page it:
// 1. refuses absolute http(s) references in src, href, srcset and CSS url(),
//    so no page or stylesheet can load anything from another origin, and
//    style attributes and <style> elements, which the policy blocks (Vue writes
//    an empty attribute for a :style binding that starts undefined, and Nuxt
//    can inline page CSS as a <style> element);
// 2. hashes the page's executable inline scripts;
// 3. inserts the Content-Security-Policy from deploy/headers.ts as a <meta> tag
//    before any script runs.
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { documentPolicy } from '../deploy/headers.ts'

const root = '.output/public'

async function filesIn(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(extension))
    .map(entry => join(entry.parentPath, entry.name))
}

const NON_EXECUTABLE = /type=["']?application\/(?:ld\+)?json/i

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(attributes!) || NON_EXECUTABLE.test(attributes!)) continue
    hashes.push(createHash('sha256').update(body!, 'utf8').digest('base64'))
  }
  return hashes
}

/**
 * References that make the browser load something from another origin by
 * itself. Ordinary links (<a href>) are left out: nothing is requested until
 * someone follows one, and Referrer-Policy: no-referrer keeps the page private.
 */
export function externalReferences(text: string): string[] {
  const external = '((?:https?:)?\\/\\/[^"\'\\s>)]+)'
  const tags = [...text.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)]
    .filter(([, name]) => name!.toLowerCase() !== 'a')
    .map(([tag]) => tag)
  const inTags = tags.flatMap(tag =>
    [...tag.matchAll(new RegExp(`\\b(?:src|href|srcset|action|poster|data|formaction)\\s*=\\s*["']?\\s*${external}`, 'gi'))])
  const inCss = [
    ...text.matchAll(new RegExp(`url\\(\\s*["']?${external}`, 'gi')),
    ...text.matchAll(new RegExp(`@import\\s+["']${external}`, 'gi')),
  ]
  return [...inTags, ...inCss].map(match => match[1]!)
}

/** Tags with a style attribute; the CSP (style-src 'self') blocks every one of them. */
export function styleAttributes(html: string): string[] {
  return [...html.matchAll(/<[a-z][\w-]*\b[^>]*\sstyle\s*=[^>]*>/gi)].map(([tag]) => tag)
}

/** Inline <style> elements; the CSP blocks them, so all CSS must come from files. */
export function styleElements(html: string): string[] {
  return [...html.matchAll(/<style\b[^>]*>/gi)].map(([tag]) => tag)
}

export function withPolicyMeta(html: string, policy: string): string {
  if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error('Page already has a CSP meta tag')
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`
  // Right after the charset declaration (or <head>), so it precedes every script.
  const anchor = /<meta charset="[^"]*">/i.exec(html) ?? /<head[^>]*>/i.exec(html)
  if (!anchor) throw new Error('No <head> to place the CSP in')
  const at = anchor.index + anchor[0].length
  return html.slice(0, at) + meta + html.slice(at)
}

async function main() {
  const problems: string[] = []

  for (const file of await filesIn(root, '.css')) {
    for (const reference of externalReferences(await readFile(file, 'utf8'))) problems.push(`${file}: ${reference}`)
  }

  const pages = await filesIn(root, '.html')
  for (const file of pages) {
    const html = await readFile(file, 'utf8')
    for (const reference of externalReferences(html)) problems.push(`${file}: ${reference}`)
    for (const tag of styleAttributes(html)) problems.push(`${file}: style attribute in ${tag.slice(0, 80)}`)
    for (const tag of styleElements(html)) problems.push(`${file}: inline ${tag}`)
    await writeFile(file, withPolicyMeta(html, documentPolicy(inlineScriptHashes(html))))
  }

  if (problems.length > 0) {
    console.error('The build would break the Content-Security-Policy:\n' + problems.join('\n'))
    process.exit(1)
  }
  console.log(`Content-Security-Policy added to ${pages.length} pages.`)
}

if (import.meta.main) await main()
