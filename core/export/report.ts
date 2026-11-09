/**
 * The cleaning report: a plain text file that goes with the cleaned CSV, so
 * the CSV stays pure data. All wording is passed in, already translated.
 */
export type ReportInput = {
  title: string
  /** Label and value pairs, such as the file names, the date and the version. */
  details: [label: string, value: string][]
  removedHeading: string
  /** Label and count per type, plus any lines about undecided or kept findings. */
  removed: [label: string, count: string][]
  nothingRemoved: string
  notes: string[]
  limitsHeading: string
  limits: string
}

const RULE = '-'.repeat(60)

/** Wraps text at word boundaries so the report reads well in any editor. */
export function wrap(text: string, width = 72): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    }
    else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

function aligned(pairs: [string, string][]): string[] {
  const width = Math.max(0, ...pairs.map(([label]) => label.length))
  return pairs.map(([label, value]) => `${label.padEnd(width)}  ${value}`)
}

export function cleaningReport(input: ReportInput): string {
  const lines = [
    input.title,
    RULE,
    ...aligned(input.details),
    '',
    input.removedHeading,
    ...(input.removed.length > 0 ? aligned(input.removed).map(line => `  ${line}`) : [`  ${input.nothingRemoved}`]),
    ...(input.notes.length > 0 ? ['', ...input.notes.flatMap(note => wrap(note))] : []),
    '',
    input.limitsHeading,
    ...wrap(input.limits),
  ]
  return `${lines.join('\r\n')}\r\n`
}

/** A timestamp for the report: local date and time, minute precision, with the UTC offset. */
export function reportTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (UTC${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)})`
}
