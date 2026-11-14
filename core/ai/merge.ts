// Merging (Stage 3, slice 5, #127): the labels the AI found in the texts go
// back to it, one kind at a time, to be grouped into themes. Only labels are
// sent, never texts, quotes or item ids. The answer only says which labels
// belong together and what the theme is called; every number is counted in
// code afterwards (themes.ts). Plain code: the sending is passed in.
import type { AnalysisPayload } from './payload.ts'
import type { AiProblem } from './providers.ts'
import { sendWithRetries, type BatchReply, type RunOptions } from './run.ts'
import { answerText, PLACEHOLDER, tidy, usageOf, type TaggedText } from './tagging.ts'

export const KINDS = ['jobs', 'pains', 'gains'] as const
export type Kind = typeof KINDS[number]

/** A distinct label as sent: a short id, the label, and how many texts it came from. */
export type MergeLabel = { id: string, label: string, count: number }

/** A theme as merged: its name and the labels in it, by their key (see labelKey). */
export type MergedTheme = { name: string, labels: string[] }

/** The answer's shape, for the provider's structured output and for the check here. */
export const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'labels'],
        additionalProperties: false,
      },
    },
  },
  required: ['themes'],
  additionalProperties: false,
}

// Labels per request. Above this, a kind is merged in parts and the parts'
// themes are merged once more, so each answer stays short and checkable.
export const MERGE_CHUNK = 300

/** Labels that differ only in case or spacing are one label. */
export const labelKey = (label: string) => tidy(label).toLowerCase()

/** The distinct labels of one kind, most frequent first, each counted once per text. */
export function labelsOf(tagged: Iterable<TaggedText>, kind: Kind): MergeLabel[] {
  const found = new Map<string, { label: string, count: number }>()
  for (const text of tagged) {
    for (const key of new Set(text[kind].map(tag => labelKey(tag.label)))) {
      const entry = found.get(key)
      if (entry) entry.count++
      else found.set(key, { label: text[kind].find(tag => labelKey(tag.label) === key)!.label, count: 1 })
    }
  }
  return [...found.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry, index) => ({ id: `l${index + 1}`, ...entry }))
}

/** What one merge request carries besides the instructions: the kind and its labels as JSON. */
export const mergeContent = (kind: Kind, labels: readonly MergeLabel[]) =>
  JSON.stringify({ kind, labels: labels.map(({ id, label, count }) => ({ id, label, count })) })

export type CheckedMerge = {
  /** Themes with the ids of their labels. */
  themes: Array<{ name: string, ids: string[] }>
  /** Labels the answer left out. */
  missing: string[]
  /** Theme names that were empty or held a placeholder: replaced by their most frequent label. */
  droppedNames: number
}

/**
 * Checks a merge answer against the labels it answers. Returns undefined if it
 * is not the agreed shape. Unknown ids are ignored, a label in two themes
 * stays in the first, and labels left out are listed in `missing`.
 */
export function checkMerge(labels: readonly MergeLabel[], json: string): CheckedMerge | undefined {
  let answer: unknown
  try {
    answer = JSON.parse(json)
  }
  catch {
    return undefined
  }
  const entries = (answer as { themes?: unknown })?.themes
  if (!Array.isArray(entries)) return undefined

  const byId = new Map(labels.map(label => [label.id, label]))
  const placed = new Set<string>()
  const themes: CheckedMerge['themes'] = []
  let droppedNames = 0
  for (const entry of entries as Array<{ name?: unknown, labels?: unknown }>) {
    if (typeof entry?.name !== 'string' || !Array.isArray(entry.labels)) continue
    const ids = entry.labels.filter((id): id is string => typeof id === 'string' && byId.has(id) && !placed.has(id))
    if (ids.length === 0) continue
    for (const id of ids) placed.add(id)
    let name = tidy(entry.name)
    if (!name || PLACEHOLDER.test(name)) {
      droppedNames++
      // The label from the most texts; labels never hold a placeholder (checked when tagging).
      name = ids.map(id => byId.get(id)!).sort((a, b) => b.count - a.count)[0]!.label
    }
    themes.push({ name, ids })
  }
  return { themes, missing: labels.map(label => label.id).filter(id => !placed.has(id)), droppedNames }
}

export type MergeOptions = {
  /** The tagged texts of the run. */
  tagged: ReadonlyMap<string, TaggedText>
  provider: AnalysisPayload['provider']
  /** Sends one kind's labels (mergeContent) with the payload's merge instructions. */
  send: (content: string) => Promise<BatchReply>
  /** Kinds already merged in an earlier run: never sent again. */
  done?: Partial<Record<Kind, MergedTheme[]>>
  signal: AbortSignal
  onProgress?: (merged: number, total: number) => void
  wait?: RunOptions['wait']
}

export type MergeResult = {
  themes: Partial<Record<Kind, MergedTheme[]>>
  droppedNames: number
  usage: { input: number, output: number }
  stopped?: AiProblem | 'cancelled'
}

/** Merges each kind's labels into themes: jobs, pains and gains, one after another. */
export async function runMerge(options: MergeOptions): Promise<MergeResult> {
  const { tagged, provider, send, signal, onProgress, wait } = options
  const result: MergeResult = { themes: { ...options.done }, droppedNames: 0, usage: { input: 0, output: 0 } }
  const report = () => onProgress?.(KINDS.filter(kind => result.themes[kind]).length, KINDS.length)
  report()

  type Group = { name: string, members: MergeLabel[] }

  /** One request for these labels, with one retry for a broken answer and one for labels left out. */
  async function mergeOnce(kind: Kind, labels: MergeLabel[]): Promise<Group[] | undefined> {
    const sent = labels.map((label, index) => ({ ...label, id: `l${index + 1}` }))
    const original = new Map(sent.map((label, index) => [label.id, labels[index]!]))
    const groups: Group[] = []
    let waiting = sent
    for (let retries = 1; ; retries--) {
      if (signal.aborted || result.stopped) return undefined
      const reply = await sendWithRetries(() => send(mergeContent(kind, waiting)), signal, wait)
      if (!reply) return undefined
      if ('stopped' in reply) {
        result.stopped ??= reply.stopped
        return undefined
      }
      const usage = usageOf(provider, reply.body)
      if (usage) {
        result.usage.input += usage.input
        result.usage.output += usage.output
      }
      const text = answerText(provider, reply.body)
      // Too long for one answer: merge each half on its own.
      if (text === 'cutOff' && waiting.length > 1) {
        const half = Math.ceil(waiting.length / 2)
        const first = await mergeOnce(kind, waiting.slice(0, half).map(label => original.get(label.id)!))
        const second = first && await mergeOnce(kind, waiting.slice(half).map(label => original.get(label.id)!))
        return second && [...groups, ...first!, ...second]
      }
      const checked = text !== 'cutOff' && text !== 'refused' && text !== 'invalid' ? checkMerge(waiting, text) : undefined
      if (!checked && retries > 0) continue
      if (checked) {
        result.droppedNames += checked.droppedNames
        for (const theme of checked.themes) groups.push({ name: theme.name, members: theme.ids.map(id => original.get(id)!) })
      }
      const missing = checked ? waiting.filter(label => checked.missing.includes(label.id)) : waiting
      if (missing.length > 0 && retries > 0) {
        waiting = missing
        continue
      }
      // Never lost: a label the AI could not place is a theme of its own.
      for (const label of missing) groups.push({ name: original.get(label.id)!.label, members: [original.get(label.id)!] })
      return groups
    }
  }

  async function mergeKind(kind: Kind): Promise<MergedTheme[] | undefined> {
    const labels = labelsOf(tagged.values(), kind)
    if (labels.length === 0) return []
    let groups: Group[] | undefined
    if (labels.length <= MERGE_CHUNK) {
      groups = await mergeOnce(kind, labels)
    }
    else {
      // In parts, then the parts' themes once more, each as a label counting all its texts.
      const parts: Group[] = []
      for (let start = 0; start < labels.length; start += MERGE_CHUNK) {
        const part = await mergeOnce(kind, labels.slice(start, start + MERGE_CHUNK))
        if (!part) return undefined
        parts.push(...part)
      }
      const asLabels = parts.map((part, index) => ({ id: `p${index}`, label: part.name, count: part.members.reduce((sum, label) => sum + label.count, 0) }))
      const top = await mergeOnce(kind, asLabels)
      groups = top?.map(group => ({ name: group.name, members: group.members.flatMap(label => parts[Number(label.id.slice(1))]!.members) }))
    }
    return groups?.map(group => ({ name: group.name, labels: group.members.map(label => labelKey(label.label)) }))
  }

  for (const kind of KINDS) {
    if (result.themes[kind] || signal.aborted || result.stopped) continue
    const themes = await mergeKind(kind)
    if (themes) result.themes[kind] = themes
    report()
  }
  if (signal.aborted && KINDS.some(kind => !result.themes[kind])) result.stopped ??= 'cancelled'
  return result
}
