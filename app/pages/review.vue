<script setup lang="ts">
import type { PiiType } from '~~/core/pii-types'
import { OverlapError, type Decision, type Finding } from '~~/core/review/review'
import type { CellSelection } from '~/utils/selection'

definePageMeta({
  step: 2,
  // Nothing to review without a checked file; this runs in the browser only.
  middleware: () => {
    if (import.meta.client && !useSession().review.value) return navigateTo('/')
  },
})

const BATCH = 100
const { t } = useI18n()
const { number } = useFormat()
const session = useSession()
const { table, review, revision, feedbackColumn, scanColumns } = session

const filterType = ref<PiiType | 'ALL'>('ALL')
const onlyWithFindings = ref(false)
const selectedId = ref<number>()
const sweepKeys = shallowRef<ReadonlySet<string>>(new Set())
const marking = ref<CellSelection & { text: string }>()
const problem = ref<string>()
const announcement = ref('')
const visibleCount = ref(BATCH)
const sentinel = useTemplateRef<HTMLElement>('sentinel')

// A fresh array per revision: marking text adds findings to the same list, and
// an unchanged reference would not update anything computed from it.
const all = computed<readonly Finding[]>(() => (revision.value, [...(review.value?.findings ?? [])]))
const counts = computed(() => (revision.value, review.value?.counts() ?? { total: 0, reviewed: 0, left: 0 }))
const navigable = computed(() => all.value.filter(finding => filterType.value === 'ALL' || finding.type === filterType.value))
const selected = computed(() => all.value.find(finding => finding.id === selectedId.value))

const typeCounts = computed(() => {
  const byType = new Map<PiiType, number>()
  for (const finding of all.value) byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1)
  return [...byType]
})

const findingsByCell = computed(() => {
  const byCell = new Map<string, Finding[]>()
  for (const finding of all.value) {
    const key = `${finding.row}:${finding.column}`
    byCell.set(key, [...(byCell.get(key) ?? []), finding])
  }
  return byCell
})

// Every row is shown by default in v0.1: names are not detected yet, and rows
// without findings are where they hide.
const rowIndices = computed(() => {
  if (!table.value) return []
  if (filterType.value === 'ALL' && !onlyWithFindings.value) return table.value.rows.map((_, index) => index)
  return [...new Set(navigable.value.map(finding => finding.row))]
})
const shownRows = computed(() => rowIndices.value.slice(0, visibleCount.value))

// Checked columns that hold free text, where missed names can hide; short
// columns such as channel or plan only show where they have a finding.
const FREE_TEXT_AVERAGE = 20
const freeTextColumns = computed(() => new Set(scanColumns.value.filter((column) => {
  const filled = table.value?.rows.map(row => row[column]?.trim() ?? '').filter(Boolean) ?? []
  return filled.length > 0 && filled.reduce((sum, text) => sum + text.length, 0) / filled.length >= FREE_TEXT_AVERAGE
})))

/** The checked cells of a row worth showing: the feedback column, other free-text columns, and any cell with a finding. */
function cellsFor(row: number) {
  const ordered = [...scanColumns.value].sort((a, b) => Number(b === feedbackColumn.value) - Number(a === feedbackColumn.value))
  const cells = ordered.flatMap((column) => {
    const text = table.value!.rows[row]![column] ?? ''
    const findings = findingsByCell.value.get(`${row}:${column}`) ?? []
    const show = column === feedbackColumn.value || freeTextColumns.value.has(column) || findings.length > 0
    return show ? [{ column, text, findings }] : []
  })
  return cells.map(cell => ({ ...cell, label: cells.length > 1 || cell.column !== feedbackColumn.value ? table.value!.columns[cell.column] : undefined }))
}

const heading = computed(() => t('review.heading', {
  findings: t('review.findings', { n: number(counts.value.total) }, counts.value.total),
  rows: t('file.rows', { n: number(table.value?.rows.length ?? 0) }, table.value?.rows.length ?? 0),
}))
const progress = computed(() => (counts.value.total === 0 ? 1 : counts.value.reviewed / counts.value.total))

async function select(id: number | undefined, focus = true) {
  selectedId.value = id
  problem.value = undefined
  const finding = selected.value
  if (!finding) return
  const position = rowIndices.value.indexOf(finding.row)
  if (position >= visibleCount.value) visibleCount.value = position + BATCH
  if (!focus) return
  await nextTick()
  const element = document.querySelector<HTMLElement>(`[data-finding="${finding.id}"]`)
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: 'center' })
}

function step(direction: 1 | -1) {
  const list = navigable.value
  if (list.length === 0) return
  const index = list.findIndex(finding => finding.id === selectedId.value)
  const next = index === -1 ? (direction === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + direction))
  select(list[next]!.id)
}

function nextPending(after: Finding): Finding | undefined {
  const list = navigable.value
  const index = list.findIndex(finding => finding.id === after.id)
  const pending = (finding: Finding) => !review.value?.decisionFor(finding.key)
  return list.slice(index + 1).find(pending) ?? list.slice(0, index).find(pending)
}

function decide(decision: Decision) {
  const finding = selected.value
  if (!finding) return
  session.change(current => current.decide(finding.key, decision))
  sweepKeys.value = decision === 'remove' ? new Set([finding.key]) : new Set()
  announcement.value = t(`review.announce.${decision}`, { type: t(`typeOne.${finding.type}`), left: number(counts.value.left) })
  const next = nextPending(finding)
  if (next) select(next.id)
}

function undo() {
  const undone = session.change(current => current.undo())
  sweepKeys.value = new Set()
  announcement.value = t(undone ? 'review.announce.undo' : 'review.announce.nothingToUndo')
  if (selectedId.value && !selected.value) selectedId.value = undefined
}

function removeAll() {
  session.change(current => current.removeAllLeft())
  sweepKeys.value = new Set()
  announcement.value = t('review.announce.removeAll')
}

function startMark() {
  const range = selectedCellRange(window.getSelection(), (row, column) => table.value?.rows[row]?.[column] ?? '')
  if (typeof range === 'string') {
    problem.value = t(`review.mark.${range}`)
    return
  }
  problem.value = undefined
  marking.value = { ...range, text: table.value!.rows[range.row]![range.column]!.slice(range.start, range.end) }
}

function confirmMark(type: PiiType) {
  const mark = marking.value
  if (!mark) return
  try {
    const added = session.change(current => current.markMissed(mark.row, mark.column, mark.start, mark.end, type)) ?? []
    const rows = new Set(added.map(finding => finding.row)).size
    announcement.value = t('review.mark.done', { type: t(`typeOne.${type}`), n: rows }, rows)
    window.getSelection()?.removeAllRanges()
    marking.value = undefined
    sweepKeys.value = new Set()
    if (added[0]) select(added[0].id)
  }
  catch (error) {
    marking.value = undefined
    problem.value = t(error instanceof OverlapError ? 'review.mark.overlap' : 'review.mark.noSelection')
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return
  const target = event.target as HTMLElement
  if (marking.value) {
    if (event.key === 'Escape') marking.value = undefined
    return
  }
  if (target.closest('input, select, textarea, [contenteditable="true"]')) return
  const onFinding = Boolean(target.closest('[data-finding]'))
  const actions: Record<string, () => void> = {
    [SHORTCUTS.next]: () => step(1),
    [SHORTCUTS.previous]: () => step(-1),
    [SHORTCUTS.remove]: () => decide('remove'),
    [SHORTCUTS.keep]: () => decide('keep'),
    [SHORTCUTS.mark]: startMark,
    [SHORTCUTS.undo]: undo,
    ...(onFinding ? { ARROWDOWN: () => step(1), ARROWRIGHT: () => step(1), ARROWUP: () => step(-1), ARROWLEFT: () => step(-1) } : {}),
  }
  const action = actions[event.key.toUpperCase()]
  if (!action) return
  event.preventDefault()
  action()
}

watch(filterType, () => {
  visibleCount.value = BATCH
  select(navigable.value[0]?.id, false)
})
watch(onlyWithFindings, () => (visibleCount.value = BATCH))

let observer: IntersectionObserver | undefined
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  const first = navigable.value.find(finding => !review.value?.decisionFor(finding.key)) ?? navigable.value[0]
  select(first?.id, false)
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) visibleCount.value += BATCH
  }, { rootMargin: '600px' })
  watch(sentinel, (element, previous) => {
    if (previous) observer?.unobserve(previous)
    if (element) observer?.observe(element)
  }, { immediate: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  observer?.disconnect()
})
</script>

<template>
  <ClientOnly>
    <div
      v-if="review && table"
      class="max-lg:pb-72"
    >
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div>
          <h1 class="font-serif text-3xl font-semibold">
            {{ heading }}
          </h1>
          <p class="mt-1 text-sm text-ink-muted">
            {{ table.fileName }}
          </p>
        </div>
        <div class="w-full max-w-60">
          <i18n-t
            keypath="review.progress"
            tag="p"
            class="text-sm"
          >
            <template #reviewed>
              <strong>{{ number(counts.reviewed) }}</strong>
            </template>
            <template #left>
              {{ number(counts.left) }}
            </template>
          </i18n-t>
          <div
            role="progressbar"
            :aria-label="$t('review.progressLabel')"
            aria-valuemin="0"
            :aria-valuemax="counts.total"
            :aria-valuenow="counts.reviewed"
            class="mt-2 h-1.5 bg-rule"
          >
            <div
              class="h-full origin-left bg-ink transition-transform duration-300 motion-reduce:transition-none"
              :style="{ transform: `scaleX(${progress})` }"
            />
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-rule">
        <div
          role="group"
          :aria-label="$t('review.filterLabel')"
          class="flex flex-wrap gap-x-6"
        >
          <button
            v-for="[type, count] in [['ALL', counts.total] as const, ...typeCounts]"
            :key="type"
            type="button"
            class="-mb-px border-b-2 pb-2.5 text-sm outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="filterType === type ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink'"
            :aria-pressed="filterType === type"
            @click="filterType = type"
          >
            {{ type === 'ALL' ? $t('review.all', { n: number(count) }) : `${$t(`typeShort.${type}`)} ${number(count)}` }}
          </button>
        </div>
        <label class="mb-2.5 flex items-center gap-2 text-sm">
          <input
            v-model="onlyWithFindings"
            type="checkbox"
            class="size-4 accent-ink"
          >
          {{ $t('review.onlyWithFindings') }}
        </label>
      </div>

      <p
        v-if="counts.total === 0"
        class="mt-6 text-ink-muted"
      >
        {{ $t('review.noFindings') }}
      </p>

      <div class="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div class="paper">
          <ol
            v-if="shownRows.length > 0"
            class="border border-rule bg-sheet text-ink shadow-sheet"
          >
            <ReviewRow
              v-for="row in shownRows"
              :key="row"
              :row="row"
              :cells="cellsFor(row)"
              :selected-id="selectedId"
              :sweep-keys="sweepKeys"
              @select="select($event)"
            />
          </ol>
          <p
            v-else
            class="text-ink-muted"
          >
            {{ $t('review.noRows') }}
          </p>
          <div
            v-if="shownRows.length < rowIndices.length"
            ref="sentinel"
            class="h-px"
          />
        </div>

        <MarginNote
          :finding="selected"
          :marking="marking"
          :problem="problem"
          @remove="decide('remove')"
          @keep="decide('keep')"
          @undo="undo"
          @start-mark="startMark"
          @confirm-mark="confirmMark"
          @cancel-mark="marking = undefined"
        />
      </div>

      <div class="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-rule pt-6">
        <p class="max-w-[60ch] text-sm text-ink-muted">
          {{ $t('review.limits') }}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <p
            v-if="counts.left > 0"
            class="w-full text-right text-sm"
          >
            {{ $t('review.willRemove', { n: number(counts.left) }, counts.left) }}
          </p>
          <button
            type="button"
            class="rounded-control border border-rule-strong bg-sheet px-4 py-2.5 outline-signal hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            :disabled="counts.left === 0"
            @click="removeAll"
          >
            {{ $t('review.removeAll', { n: number(counts.left) }) }}
          </button>
          <button
            type="button"
            class="rounded-control bg-signal px-4 py-2.5 font-semibold text-on-signal outline-signal hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            @click="navigateTo('/download')"
          >
            {{ $t('review.continue') }}
          </button>
        </div>
      </div>

      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ announcement }}
      </p>
    </div>
  </ClientOnly>
</template>
