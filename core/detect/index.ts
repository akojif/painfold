import { detectEmails } from './email.ts'
import { detectIps } from './ip.ts'
import { detectUrls } from './url.ts'
import type { Detection, Detector } from './types.ts'

export type { Detection, Detector } from './types.ts'

export const DETECTORS: readonly Detector[] = [detectEmails, detectUrls, detectIps]

/**
 * Runs every detector and resolves overlaps: the longer span wins, so an email
 * inside a link is removed together with the link. Results are sorted and
 * never overlap.
 */
export function detect(text: string, detectors: readonly Detector[] = DETECTORS): Detection[] {
  const candidates = detectors.flatMap(run => run(text))
    .sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)

  const kept: Detection[] = []
  for (const candidate of candidates) {
    if (kept.every(other => candidate.end <= other.start || candidate.start >= other.end)) kept.push(candidate)
  }
  return kept.sort((a, b) => a.start - b.start)
}
