import type { PiiType } from '../pii-types.ts'
import { emailDetector } from './email.ts'
import { ipDetector } from './ip.ts'
import { urlDetector } from './url.ts'
import type { Detection, Detector } from './types.ts'

export type { Detection, Detector } from './types.ts'

export const DETECTORS: readonly Detector[] = [emailDetector, urlDetector, ipDetector]

/** The types Painfold can find today; the interface lists exactly these. */
export const DETECTED_TYPES: readonly PiiType[] = DETECTORS.map(detector => detector.type)

/**
 * Runs every detector and resolves overlaps: the longer span wins, so an email
 * inside a link is removed together with the link. Results are sorted and
 * never overlap.
 */
export function detect(text: string, detectors: readonly Detector[] = DETECTORS): Detection[] {
  const candidates = detectors.flatMap(detector => detector.detect(text))
    .sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)

  const kept: Detection[] = []
  for (const candidate of candidates) {
    if (kept.every(other => candidate.end <= other.start || candidate.start >= other.end)) kept.push(candidate)
  }
  return kept.sort((a, b) => a.start - b.start)
}
