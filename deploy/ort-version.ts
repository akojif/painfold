// The installed onnxruntime-web version (build time only). The WebAssembly files
// served from /ort/<version>/ must match the JavaScript bundled with the app.
// The package does not export its package.json, so it is read from disk.
import { readFileSync } from 'node:fs'

export function ortVersion(): string {
  return (JSON.parse(readFileSync('node_modules/onnxruntime-web/package.json', 'utf8')) as { version: string }).version
}
