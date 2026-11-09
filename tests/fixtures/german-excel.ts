// A CSV as German Excel on Windows saves it: semicolons, CRLF line endings,
// Windows-1252 encoding, decimal commas and quoted cells with semicolons and
// line breaks. Shared by the unit and end-to-end tests.
export const GERMAN_EXCEL_ROWS = [
  ['Nr', 'Datum', 'Betrag', 'Rückmeldung'],
  ['1', '04.03.2026', '12,50', 'Größere Schrift wäre schön; sonst top.'],
  ['2', '05.03.2026', '1.299,00', 'Mahnungen dauern ewig.\r\nBitte automatisch verschicken!'],
  ['3', '06.03.2026', '0,99', 'Übersicht für Steuerberater fehlt, Ärger mit Fußnoten. Schreiben Sie an jürgen@example.com'],
]

const cell = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)

export const GERMAN_EXCEL_TEXT = `${GERMAN_EXCEL_ROWS.map(row => row.map(cell).join(';')).join('\r\n')}\r\n`

/** Encodes text as Windows-1252; every character used above is in that code page. */
export function windows1252(text: string): Uint8Array {
  const extra: Record<string, number> = { '€': 0x80, '„': 0x84, '“': 0x93 }
  return Uint8Array.from(text, (char) => {
    const code = extra[char] ?? char.charCodeAt(0)
    if (code > 0xFF) throw new Error(`Not in Windows-1252: ${char}`)
    return code
  })
}
