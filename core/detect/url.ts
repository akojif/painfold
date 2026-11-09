import { detection, type Detector } from './types.ts'

// Links with a scheme or starting with www. Bare domains such as example.com
// are left alone: in feedback they usually name a product, not a person.
const URL_CANDIDATE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi
const TRAILING = /[.,;:!?'"]+$/

/** Drops sentence punctuation and closing brackets that belong to the text around the link. */
function trimEnd(candidate: string): string {
  let url = candidate.replace(TRAILING, '')
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']] as const) {
    while (url.endsWith(close) && url.split(open).length < url.split(close).length) {
      url = url.slice(0, -1).replace(TRAILING, '')
    }
  }
  return url
}

export const detectUrls: Detector = text =>
  [...text.matchAll(URL_CANDIDATE)].flatMap((match) => {
    const url = trimEnd(match[0])
    return /[\p{L}\d]\.[\p{L}]{2,}/u.test(url) ? [detection('URL', text, match.index, match.index + url.length)] : []
  })
