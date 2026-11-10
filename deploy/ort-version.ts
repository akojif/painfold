// The installed onnxruntime-web version (build time only). The WebAssembly files
// served from /ort/<version>/ must match the JavaScript bundled with the app.
// The package does not export its package.json, so it is read from disk.
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ORT_FILES } from './model.ts'

export function ortVersion(): string {
  return (JSON.parse(readFileSync('node_modules/onnxruntime-web/package.json', 'utf8')) as { version: string }).version
}

/** The size in bytes of the ONNX Runtime files the app serves, from the installed package. */
export function ortBytes(): number {
  return ORT_FILES.reduce((sum, file) => sum + statSync(join('node_modules', 'onnxruntime-web', 'dist', file)).size, 0)
}
