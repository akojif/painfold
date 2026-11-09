import type { PiiType } from '../pii-types.ts'

/** A piece of personal data found in a text, by character offsets. */
export type Detection = {
  start: number
  end: number
  type: PiiType
  value: string
}

export type Detector = {
  type: PiiType
  detect: (text: string) => Detection[]
}

export function detection(type: PiiType, text: string, start: number, end: number): Detection {
  return { type, start, end, value: text.slice(start, end) }
}
