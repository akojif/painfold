<script setup lang="ts">
import type { Finding, Warning } from '~~/core/review/review'

const props = defineProps<{
  row: number
  cells: { column: number, label?: string, text: string, findings: Finding[], warnings: Warning[] }[]
  selectedId?: number
  selectedWarningKey?: string
  motions: ReadonlyMap<string, RemovalMotion>
}>()
const emit = defineEmits<{ select: [id: number, event: MouseEvent | KeyboardEvent], selectWarning: [key: string, event: MouseEvent | KeyboardEvent] }>()
const { review, revision } = useSession()

type Piece = { kind: 'text', start: number, text: string } | { kind: 'finding', finding: Finding } | { kind: 'warning', warning: Warning }

/** The cell's text cut at its findings and warnings, which never overlap. */
function pieces(text: string, findings: Finding[], warnings: Warning[]): Piece[] {
  const marks: Piece[] = [
    ...findings.map(finding => ({ kind: 'finding' as const, finding })),
    ...warnings.map(warning => ({ kind: 'warning' as const, warning })),
  ].sort((a, b) => spanOf(a).start - spanOf(b).start)
  const result: Piece[] = []
  let last = 0
  for (const mark of marks) {
    const { start, end } = spanOf(mark)
    if (start > last) result.push({ kind: 'text', start: last, text: text.slice(last, start) })
    result.push(mark)
    last = end
  }
  if (last < text.length) result.push({ kind: 'text', start: last, text: text.slice(last) })
  return result
}

function spanOf(piece: Piece): { start: number, end: number } {
  if (piece.kind === 'finding') return piece.finding
  if (piece.kind === 'warning') return piece.warning
  return { start: piece.start, end: piece.start + piece.text.length }
}

const pieceKey = (piece: Piece) => piece.kind === 'text' ? `t${piece.start}` : piece.kind === 'finding' ? `f${piece.finding.id}` : `w${piece.warning.key}`

const isCurrent = computed(() => props.cells.some(cell => cell.findings.some(finding => finding.id === props.selectedId) || cell.warnings.some(warning => warning.key === props.selectedWarningKey)))
const hasFindings = computed(() => props.cells.some(cell => cell.findings.length > 0 || cell.warnings.length > 0))
// Read the revision so decisions re-render this row.
const decisionFor = (finding: Finding) => (revision.value, review.value?.decisionFor(finding.key))
const warningDecisionFor = (warning: Warning) => (revision.value, review.value?.warningDecisionFor(warning.key))
</script>

<template>
  <li class="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-b border-line py-4 last:border-b-0 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
    <span
      class="pt-px font-mono text-xs tabular-nums"
      :class="isCurrent ? 'text-fg' : 'text-fg-muted'"
    >{{ $t('review.row', { n: row + 1 }) }}</span>
    <div class="max-w-measure space-y-2">
      <div
        v-for="cell in cells"
        :key="cell.column"
      >
        <p
          v-if="cell.label"
          class="text-xs text-fg-muted"
        >
          {{ cell.label }}
        </p>
        <p class="break-words whitespace-pre-wrap">
          <template
            v-for="piece in pieces(cell.text, cell.findings, cell.warnings)"
            :key="pieceKey(piece)"
          >
            <span
              v-if="piece.kind === 'text'"
              :data-row="row"
              :data-column="cell.column"
              :data-offset="piece.start"
            >{{ piece.text }}</span>
            <WarningMark
              v-else-if="piece.kind === 'warning'"
              :warning="piece.warning"
              :decision="warningDecisionFor(piece.warning)"
              :placeholder="review!.placeholderForWarning(piece.warning)"
              :selected="piece.warning.key === selectedWarningKey"
              :motion="motions.get(piece.warning.key)"
              @select="emit('selectWarning', piece.warning.key, $event)"
            />
            <FindingMark
              v-else
              :finding="piece.finding"
              :decision="decisionFor(piece.finding)"
              :placeholder="review!.placeholderFor(piece.finding)"
              :selected="piece.finding.id === selectedId"
              :motion="motions.get(piece.finding.key)"
              @select="emit('select', piece.finding.id, $event)"
            />
          </template>
        </p>
      </div>
      <p
        v-if="!hasFindings"
        class="text-xs text-fg-muted"
      >
        {{ $t('review.nothingFound') }}
      </p>
    </div>
  </li>
</template>
