<script setup lang="ts">
import type { Finding } from '~~/core/review/review'

const props = defineProps<{
  row: number
  cells: { column: number, label?: string, text: string, findings: Finding[] }[]
  selectedId?: number
  motions: ReadonlyMap<string, RemovalMotion>
}>()
const emit = defineEmits<{ select: [id: number, event: MouseEvent] }>()
const { review, revision } = useSession()

type Piece = { kind: 'text', start: number, text: string } | { kind: 'finding', finding: Finding }

function pieces(text: string, findings: Finding[]): Piece[] {
  const result: Piece[] = []
  let last = 0
  for (const finding of findings) {
    if (finding.start > last) result.push({ kind: 'text', start: last, text: text.slice(last, finding.start) })
    result.push({ kind: 'finding', finding })
    last = finding.end
  }
  if (last < text.length) result.push({ kind: 'text', start: last, text: text.slice(last) })
  return result
}

const isCurrent = computed(() => props.cells.some(cell => cell.findings.some(finding => finding.id === props.selectedId)))
const hasFindings = computed(() => props.cells.some(cell => cell.findings.length > 0))
// Read the revision so decisions re-render this row.
const decisionFor = (finding: Finding) => (revision.value, review.value?.decisionFor(finding.key))
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
            v-for="piece in pieces(cell.text, cell.findings)"
            :key="piece.kind === 'text' ? `t${piece.start}` : `f${piece.finding.id}`"
          >
            <span
              v-if="piece.kind === 'text'"
              :data-row="row"
              :data-column="cell.column"
              :data-offset="piece.start"
            >{{ piece.text }}</span>
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
