import { detection, type Detector } from './types.ts'

// Local part, @, then domain labels and a top-level domain of letters, so a
// sentence-ending dot is never part of the address. Both parts may contain
// letters such as umlauts (internationalised addresses).
const EMAIL = /(?<![\p{L}\p{N}_.!#$%&'*+/=?^`{|}~-])[\p{L}\p{N}_!#$%&'*+/=?^`{|}~-]+(?:\.[\p{L}\p{N}_!#$%&'*+/=?^`{|}~-]+)*@(?:[\p{L}\d](?:[\p{L}\d-]{0,61}[\p{L}\d])?\.)+\p{L}{2,63}(?![\p{L}\d-])/gu

// Addresses written to fool spam bots: "anna (at) example (dot) com",
// "anna [ät] example [punkt] at". Both the at and the dot must be bracketed.
const OBFUSCATED = /(?<![\w.-])[\w.+-]+\s*[([{]\s*(?:at|ät|@)\s*[)\]}]\s*[\p{L}\d-]+(?:\s*[([{]\s*(?:dot|punkt|\.)\s*[)\]}]\s*[\p{L}\d-]+)+/giu

export const detectEmails: Detector = (text) => {
  const found = [...text.matchAll(EMAIL), ...text.matchAll(OBFUSCATED)]
  return found.map(match => detection('EMAIL', text, match.index, match.index + match[0].length))
}
