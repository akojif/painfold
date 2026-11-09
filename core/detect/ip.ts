import { detection, type Detector } from './types.ts'

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`(?<![\\d.])${OCTET}(?:\\.${OCTET}){3}(?![\\d.]*\\d)`, 'g')

// A dotted number next to these words is a version, not an address.
// "Update auf 2.14.3.1" and "update to 2.14.3.1" count; "logins from 203.0.113.7" does not.
const VERSION_BEFORE = /\b(?:version|ver|v|release|build|update|ios|android)\s*\.?\s*(?:auf|to|zu)?\s*$/i
const VERSION_AFTER = /^\s*(?:update|release|version|build|beta)\b/i

const IPV6_CANDIDATE = /(?<![\w:])[\da-f]{0,4}(?::[\da-f]{0,4}){2,7}(?::\d{1,3}(?:\.\d{1,3}){3})?(?![\w:])/gi

/** Checks a candidate against the IPv6 text format, including :: shortening. */
function isIpv6(candidate: string): boolean {
  const halves = candidate.split('::')
  if (halves.length > 2) return false
  const groups = halves.flatMap(half => (half === '' ? [] : half.split(':')))
  if (groups.some(group => !/^[\da-f]{1,4}$/i.test(group))) return false
  return halves.length === 2 ? groups.length <= 7 : groups.length === 8
}

export const ipDetector: Detector = {
  type: 'IP',
  detect: (text) => {
    const v4 = [...text.matchAll(IPV4)].filter(match =>
      !VERSION_BEFORE.test(text.slice(Math.max(0, match.index - 24), match.index))
      && !VERSION_AFTER.test(text.slice(match.index + match[0].length)),
    )
    const v6 = [...text.matchAll(IPV6_CANDIDATE)].filter(match => isIpv6(match[0]))
    return [...v4, ...v6].map(match => detection('IP', text, match.index, match.index + match[0].length))
  },
}
