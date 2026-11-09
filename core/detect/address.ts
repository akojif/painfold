import { detection, type Detection, type Detector } from './types.ts'

const NAME_WORD = '[A-ZÄÖÜ][\\p{L}-]*'
// Words before a street name are adjectives such as "Obere", "Mariahilfer" or
// "Wiedner"; a capitalised noun ("Wohnhaft", "Lieferung") is not part of it.
// At most two, which also keeps the pattern fast.
const ADJECTIVE = '[A-ZÄÖÜ][\\p{L}-]*(?:e|er|en|es)'
// German and Austrian street suffixes, joined ("Mühlbachstraße") or separate ("Mariahilfer Straße").
const SUFFIX = '(?:straße|strasse|str\\.|gasse|g\\.|weg|platz|pl\\.|allee|ring|damm|ufer|steig|zeile|kai|promenade|graben|markt|lände|steg|gürtel|hof|berg|feld|wiese|park)'
const STREET_DE = [
  // One word ending in a suffix, optionally after adjectives: "Ahornweg", "Obere Donaustraße".
  `(?:${ADJECTIVE} ){0,2}[A-ZÄÖÜ][\\p{L}-]*${SUFFIX}`,
  // A name and a separate suffix word: "Mariahilfer Straße", "Am Hof", "Wiedner Hauptstraße".
  `${NAME_WORD} (?:Straße|Strasse|Str\\.|Gasse|Weg|Platz|Allee|Ring|Gürtel|Lände|Kai|Zeile)`,
  // "Am Steinfeld", "An der Au", "Auf dem Berg", "Im Winkel".
  `(?:Am|An der|An den|Auf der|Auf dem|Im|In der|Zum|Zur|Unter den|Hinter der|Bei der) ${NAME_WORD}`,
].join('|')

// House number with Austrian door parts: "12", "12a", "12-14", "45/3", "12/3/7",
// then optional ", Stiege 2", "Stg. 2", "Top 5", "Tür 3", "/Top 5".
const NUMBER = '\\d{1,4}[a-z]?(?:\\s?[-–]\\s?\\d{1,4}[a-z]?)?(?:\\s?/\\s?\\d{1,4}[a-z]?){0,3}'
const DOOR = '(?:(?:,\\s*|\\s*/\\s*|\\s+)(?:Stiege|Stg\\.|Haus|Stock|St\\.|Top|Tür)\\s?\\d{1,4}[a-z]?)*'

const STREET_ADDRESS_DE = new RegExp(`(?<![\\p{L}])(?:${STREET_DE})\\s+${NUMBER}${DOOR}(?![\\p{L}\\d])`, 'gu')

// English: "27 Willow Lane", "12 Baker Street", "5a Mill Row".
const STREET_EN = '(?:Street|St\\.|Road|Rd\\.|Lane|Ln\\.|Avenue|Ave\\.|Close|Row|Drive|Dr\\.|Way|Court|Ct\\.|Place|Square|Crescent|Terrace|Gardens|Grove|Hill|Mews|Walk|Parade)'
const STREET_ADDRESS_EN = new RegExp(`(?<![\\p{L}\\d])\\d{1,4}[a-z]?\\s+(?:${NAME_WORD}\\s+){1,3}${STREET_EN}(?![\\p{L}])`, 'gu')

/**
 * Street addresses: German and Austrian streets (-straße, -gasse, -weg,
 * -platz, -allee, "Am Steinfeld") with a house number and Austrian door parts
 * ("Hauptstraße 12/3/7", "Stiege 2", "Top 5"), and English streets with the
 * number in front ("27 Willow Lane").
 */
export const addressDetector: Detector = {
  type: 'ADDRESS',
  detect: text => [...text.matchAll(STREET_ADDRESS_DE), ...text.matchAll(STREET_ADDRESS_EN)]
    .map(match => detection('ADDRESS', text, match.index, match.index + match[0].length)),
}

// UK postcodes are distinctive enough on their own: "BS1 4DJ", "SW1A 1AA".
const UK_POSTCODE = /(?<![\p{L}\d])[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}(?![\p{L}\d])/gu
// German (5 digits) and Austrian (4 digits) postcodes followed by a town name,
// optionally with a country prefix: "1060 Wien", "A-6020 Innsbruck", "80331 München".
const DACH_POSTCODE = /(?<![\p{L}\d.,/-])(?:(?:A|D|AT|DE)-)?(\d{4,5})(?=\s+[A-ZÄÖÜ][\p{L}]+(?:\s(?:an der|am|im|in|bei)\s[A-ZÄÖÜ][\p{L}]+)?)/gu
// Words that make a postcode likely even without a street next to it.
const POSTCODE_CONTEXT = /(?:\bplz\b|\bpostleitzahl\b|\badress\w*|\banschrift\b|\bwohn\w*|\bliefer\w*|\bzustell\w*|\baddress\b|\bship(?:ping)? to\b|\bdeliver\w*|\bmoved to\b|\blive in\b|\bin\b)[^.\d]{0,20}$/iu

/**
 * Postcodes. UK postcodes are detected on their own. A German or Austrian
 * postcode must be followed by a town name and either come right after a
 * street address or follow a word such as "PLZ", "Adresse" or "in", so that
 * "1070 Rechnungen" stays a number.
 */
export const postcodeDetector: Detector = {
  type: 'POSTCODE',
  detect: (text) => {
    const found: Detection[] = [...text.matchAll(UK_POSTCODE)].map(match => detection('POSTCODE', text, match.index, match.index + match[0].length))
    const addresses = addressDetector.detect(text)
    for (const match of text.matchAll(DACH_POSTCODE)) {
      const start = match.index + match[0].length - match[1]!.length
      const afterAddress = addresses.some(address => address.end <= match.index && /^[\s,]*$/.test(text.slice(address.end, match.index)))
      const prefixed = match[0].length > match[1]!.length
      if (afterAddress || prefixed || POSTCODE_CONTEXT.test(text.slice(Math.max(0, match.index - 30), match.index))) {
        found.push(detection('POSTCODE', text, start, start + match[1]!.length))
      }
    }
    return found
  },
}
