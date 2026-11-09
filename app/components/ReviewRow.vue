<script setup lang="ts">
import type { Finding } from '~~/core/review/review'

const props = defineProps<{ row: number, cells: { column: number, label?: string, text: string, findings: Finding[] }[], selectedId?: number, sweepKeys: ReadonlySet<string> }>()
const emit = defineEmits<{ select: [id: number] }>()
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
  <li
    class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 border-b border-rule px-5 py-5 last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:px-7"
    :class="{ 'bg-highlighter/25': isCurrent }"
  >
    <span
      class="pt-1 font-mono text-xs text-ink-muted"
      :class="{ 'font-semibold text-ink': isCurrent }"
    >{{ $t('review.row', { n: row + 1 }) }}</span>
    <div class="space-y-2">
      <div
        v-for="cell in cells"
        :key="cell.column"
      >
        <p
          v-if="cell.label"
          class="text-xs text-ink-muted"
        >
          {{ cell.label }}
        </p>
        <p class="font-serif text-voice break-words whitespace-pre-wrap">
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
              :sweep="sweepKeys.has(piece.finding.key)"
              @select="emit('select', piece.finding.id)"
            />
          </template>
        </p>
      </div>
      <p
        v-if="!hasFindings"
        class="text-xs text-ink-muted"
      >
        {{ $t('review.nothingFound') }}
      </p>
    </div>
  </li>
</template>
