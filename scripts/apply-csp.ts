// Runs after `nuxt generate`. For every HTML page it:
// 1. refuses absolute http(s) references in src, href, srcset and CSS url(),
//    so no page or stylesheet can load anything from another origin;
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

export function externalReferences(text: string): string[] {
  const patterns = [
    /\b(?:src|href|srcset|action|poster|data)\s*=\s*["']?\s*((?:https?:)?\/\/[^"'\s>]+)/gi,
    /url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi,
    /@import\s+["']((?:https?:)?\/\/[^"']+)/gi,
  ]
  return patterns.flatMap(pattern => [...text.matchAll(pattern)].map(match => match[1]!))
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
    await writeFile(file, withPolicyMeta(html, documentPolicy(inlineScriptHashes(html))))
  }

  if (problems.length > 0) {
    console.error('References to other origins found in the build:\n' + problems.join('\n'))
    process.exit(1)
  }
  console.log(`Content-Security-Policy added to ${pages.length} pages.`)
}

if (import.meta.main) await main()
