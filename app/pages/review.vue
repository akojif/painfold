<script setup lang="ts">
import { PII_TYPES, type PiiType } from '~~/core/pii-types'
import { OverlapError, type Decision, type Finding } from '~~/core/review/review'
import type { CellSelection } from '~/utils/selection'
import type { ValueEntry, ValueGroup } from '~/utils/value-list'

definePageMeta({
  step: 2,
  // Nothing to review without a checked file; this runs in the browser only.
  middleware: () => {
    if (import.meta.client && !useSession().review.value) return navigateTo(useLocalePath()('/'))
  },
})

const BATCH = 100
// Values shown per type before "Show more", so every type and its bulk removal stay in view.
const VALUE_BATCH = 100
const SNIPPETS = 5
const { t } = useI18n()
const localePath = useLocalePath()
const { number } = useFormat()
const session = useSession()
const { table, review, revision, feedbackColumn, scanColumns } = session
// Names and places arrive in the background; the download waits for them.
const { busy: checkingNames } = useNameScan()

// By value: each distinct value once, decided for every copy. By row: the file as written.
const view = ref<'value' | 'row'>('value')
const onlyWithFindings = ref(false)
const selectedId = ref<number>()
const motions = shallowRef<ReadonlyMap<string, RemovalMotion>>(new Map())
const marking = ref<CellSelection & { text: string }>()
const problem = ref<string>()
const announcement = ref('')
const visibleCount = ref(BATCH)
const shownPerType = ref<Partial<Record<PiiType, number>>>({})
const sentinel = useTemplateRef<HTMLElement>('sentinel')

// A fresh array per revision: marking text adds findings to the same list, and
// an unchanged reference would not update anything computed from it.
const all = computed<readonly Finding[]>(() => (revision.value, [...(review.value?.findings ?? [])]))
const counts = computed(() => (revision.value, review.value?.counts() ?? { total: 0, reviewed: 0, left: 0 }))
const kept = computed(() => (revision.value, all.value.filter(finding => review.value?.decisionFor(finding.key) === 'keep').length))
const selected = computed(() => all.value.find(finding => finding.id === selectedId.value))
const finished = computed(() => counts.value.total > 0 && counts.value.left === 0)

// One entry per distinct value, grouped by type, in order of first appearance within a type.
const values = computed<ValueEntry[]>(() => {
  const byKey = new Map<string, { finding: Finding, rows: Set<number> }>()
  for (const finding of all.value) {
    const entry = byKey.get(finding.key)
    if (entry) entry.rows.add(finding.row)
    else byKey.set(finding.key, { finding, rows: new Set([finding.row]) })
  }
  return [...byKey.values()]
    .map(({ finding, rows }) => ({ key: finding.key, type: finding.type, finding, rows: rows.size }))
    .sort((a, b) => PII_TYPES.indexOf(a.type) - PII_TYPES.indexOf(b.type))
})
const valuesByType = computed(() => {
  const byType = new Map<PiiType, ValueEntry[]>()
  for (const entry of values.value) {
    const entries = byType.get(entry.type)
    if (entries) entries.push(entry)
    else byType.set(entry.type, [entry])
  }
  return byType
})
const groups = computed<ValueGroup[]>(() => {
  const pending = new Map<PiiType, number>()
  for (const finding of all.value) {
    if (!review.value?.decisionFor(finding.key)) pending.set(finding.type, (pending.get(finding.type) ?? 0) + 1)
  }
  return [...valuesByType.value].map(([type, entries]) => {
    const limit = shownPerType.value[type] ?? VALUE_BATCH
    return { type, pending: pending.get(type) ?? 0, values: entries.slice(0, limit), more: Math.max(0, Math.min(VALUE_BATCH, entries.length - limit)) }
  })
})

function showMore(type: PiiType) {
  shownPerType.value = { ...shownPerType.value, [type]: (shownPerType.value[type] ?? VALUE_BATCH) + VALUE_BATCH }
}

// N and P step through values in the By value view and through findings in the By row view.
const navigable = computed(() => (view.value === 'value' ? values.value.map(entry => entry.finding) : all.value))
const position = (finding?: Finding) => navigable.value.findIndex(item => (view.value === 'value' ? item.key === finding?.key : item.id === finding?.id))

const findingsByCell = computed(() => {
  const byCell = new Map<string, Finding[]>()
  for (const finding of all.value) {
    const key = `${finding.row}:${finding.column}`
    byCell.set(key, [...(byCell.get(key) ?? []), finding])
  }
  return byCell
})

// Every row is shown by default: names can still be missed (and are not found
// at all without the name model), and rows without findings are where they hide.
const rowIndices = computed(() => {
  if (!table.value) return []
  if (!onlyWithFindings.value) return table.value.rows.map((_, index) => index)
  return [...new Set(all.value.map(finding => finding.row))]
})
const shownRows = computed(() => rowIndices.value.slice(0, visibleCount.value))

// The rows the selected value appears in, for the By value view.
const valueRows = computed(() => {
  const finding = selected.value
  if (!finding || !review.value) return []
  return [...new Set((revision.value, review.value.copiesOf(finding.key)).map(copy => copy.row))]
})

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
  let target = `[data-finding="${finding.id}"]`
  if (view.value === 'value') {
    const ofType = valuesByType.value.get(finding.type) ?? []
    const index = ofType.findIndex(entry => entry.key === finding.key)
    if (index >= (shownPerType.value[finding.type] ?? VALUE_BATCH)) shownPerType.value = { ...shownPerType.value, [finding.type]: index + VALUE_BATCH }
    target = `[data-value="${ofType[index]?.finding.id}"]`
  }
  else {
    const index = rowIndices.value.indexOf(finding.row)
    if (index >= visibleCount.value) visibleCount.value = index + BATCH
  }
  if (!focus) return
  await nextTick()
  const element = document.querySelector<HTMLElement>(target)
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: view.value === 'value' ? 'nearest' : 'center' })
}

function step(direction: 1 | -1) {
  const list = navigable.value
  if (list.length === 0) return
  const index = position(selected.value)
  const next = index === -1 ? (direction === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + direction))
  select(list[next]!.id)
}

function nextPending(after: Finding): Finding | undefined {
  const list = navigable.value
  const index = position(after)
  const pending = (finding: Finding) => !review.value?.decisionFor(finding.key)
  return list.slice(index + 1).find(pending) ?? list.slice(0, index).find(pending)
}

/** Decides the selected value. Without a pointer event the decision came from the keyboard. */
function decide(decision: Decision, event?: MouseEvent) {
  const finding = selected.value
  if (!finding) return
  session.change(current => current.decide(finding.key, decision))
  motions.value = decision === 'remove' ? new Map([[finding.key, motionFor(event)]]) : new Map()
  announcement.value = t(`review.announce.${decision}`, { type: t(`typeOne.${finding.type}`), left: number(counts.value.left) })
  const next = nextPending(finding)
  if (next) select(next.id, view.value === 'row' || !event)
}

function undo() {
  const undone = session.change(current => current.undo())
  motions.value = new Map()
  announcement.value = t(undone ? 'review.announce.undo' : 'review.announce.nothingToUndo')
  if (selectedId.value && !selected.value) selectedId.value = undefined
}

// Bulk removals fade: a wipe across many tokens at once would be noise.
function removeLeft(type?: PiiType) {
  const keys = new Set(all.value.filter(finding => !review.value?.decisionFor(finding.key) && (!type || finding.type === type)).map(finding => finding.key))
  session.change(current => current.removeAllLeft(type))
  motions.value = new Map([...keys].map(key => [key, 'fade' as const]))
  announcement.value = type ? t('review.announce.removeType', { type: t(`typeManyLower.${type}`) }) : t('review.announce.removeAll')
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
    const marked = added.filter(finding => finding.source === 'marked')
    const forms = added.length - marked.length
    const rows = new Set(marked.map(finding => finding.row)).size
    announcement.value = [
      t('review.mark.done', { type: t(`typeOne.${type}`), n: rows }, rows),
      ...(forms > 0 ? [t('review.mark.forms', { n: forms }, forms)] : []),
    ].join(' ')
    window.getSelection()?.removeAllRanges()
    marking.value = undefined
    motions.value = new Map()
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
  const onFinding = Boolean(target.closest('[data-finding], [data-value]'))
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

const views = ['value', 'row'] as const
function onTabKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  view.value = view.value === 'value' ? 'row' : 'value'
  nextTick(() => document.getElementById(`view-tab-${view.value}`)?.focus())
}

watch(view, () => {
  motions.value = new Map()
  // Keep the same value selected; in the By value view that is its first appearance.
  if (view.value === 'value' && selected.value) selectedId.value = values.value.find(entry => entry.key === selected.value!.key)?.finding.id
  select(selectedId.value, false)
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
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold">
            {{ heading }}
          </h1>
          <MiddleTruncate
            class="mt-1 text-sm text-fg-muted"
            :text="table.fileName"
          />
        </div>
        <i18n-t
          keypath="review.progress"
          tag="p"
          class="text-sm text-fg-muted tabular-nums"
        >
          <template #reviewed>
            <span class="font-medium text-fg">{{ number(counts.reviewed) }}</span>
          </template>
          <template #left>
            {{ number(counts.left) }}
          </template>
        </i18n-t>
      </div>
      <div
        role="progressbar"
        :aria-label="$t('review.progressLabel')"
        aria-valuemin="0"
        :aria-valuemax="counts.total"
        :aria-valuenow="counts.reviewed"
        class="mt-4 h-0.5 overflow-hidden rounded-full bg-line"
      >
        <div
          class="h-full origin-left bg-accent transition-transform duration-200 ease-out motion-reduce:transition-none"
          :style="{ transform: `scaleX(${progress})` }"
        />
      </div>
      <NameModelDownload
        compact
        class="mt-3"
      />
      <NameScanStatus class="mt-3" />

      <div
        v-if="finished && !checkingNames"
        class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-3"
        role="status"
      >
        <div class="flex items-start gap-3">
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            class="mt-0.5 size-4 shrink-0 fill-none stroke-accent stroke-2"
          >
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
          <div>
            <p class="font-medium">
              {{ $t('review.finished.title') }}
            </p>
            <p class="text-sm text-fg-muted">
              {{ $t('review.finished.body', { removed: number(counts.total - kept), kept: number(kept) }) }}
            </p>
          </div>
        </div>
        <NuxtLink
          :to="localePath('/download')"
          class="focus-ring press inline-flex h-9 items-center rounded-md bg-fg px-3.5 font-medium text-canvas"
        >
          {{ $t('review.finished.action') }}
        </NuxtLink>
      </div>

      <div class="mt-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
        <div
          role="tablist"
          :aria-label="$t('review.views.label')"
          class="flex gap-5"
        >
          <button
            v-for="option in views"
            :id="`view-tab-${option}`"
            :key="option"
            type="button"
            role="tab"
            :aria-selected="view === option"
            :aria-controls="`view-${option}`"
            :tabindex="view === option ? 0 : -1"
            class="focus-ring -mb-px rounded-t-sm border-b pb-2.5 text-sm"
            :class="view === option ? 'border-fg font-medium text-fg' : 'border-transparent text-fg-muted hover:text-fg'"
            @click="view = option"
            @keydown="onTabKey"
          >
            {{ $t(option === 'value' ? 'review.views.byValue' : 'review.views.byRow') }}
          </button>
        </div>
        <label
          v-if="view === 'row'"
          class="mb-2.5 flex items-center gap-2 text-sm"
        >
          <input
            v-model="onlyWithFindings"
            type="checkbox"
            class="focus-ring size-4 accent-fg"
          >
          {{ $t('review.onlyWithFindings') }}
        </label>
      </div>

      <p
        v-if="counts.total === 0"
        class="mt-6 text-fg-muted"
      >
        {{ $t('review.noFindings') }}
      </p>

      <div
        v-if="view === 'value'"
        id="view-value"
        role="tabpanel"
        aria-labelledby="view-tab-value"
        class="mt-6 grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]"
      >
        <div
          v-if="values.length > 0"
          class="overflow-y-auto rounded-md border border-line bg-surface max-lg:max-h-[50vh] lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)]"
        >
          <ValueList
            class="pb-6"
            :groups="groups"
            :selected-key="selected?.key"
            :motions="motions"
            @select="select($event, false)"
            @remove-type="removeLeft($event)"
            @show-more="showMore"
          />
          <!-- Fades the last visible values, so the list reads as scrollable. -->
          <div
            aria-hidden="true"
            class="pointer-events-none sticky bottom-0 -mt-6 h-6 bg-linear-to-t from-surface to-transparent"
          />
        </div>
        <div class="min-w-0">
          <MarginNote
            :finding="selected"
            :marking="marking"
            :problem="problem"
            @remove="decide('remove', $event)"
            @keep="decide('keep')"
            @undo="undo"
            @start-mark="startMark"
            @confirm-mark="confirmMark"
            @cancel-mark="marking = undefined"
          />
          <ol
            v-if="valueRows.length > 0"
            class="mt-6 border-t border-line"
          >
            <ReviewRow
              v-for="row in valueRows.slice(0, SNIPPETS)"
              :key="row"
              :row="row"
              :cells="cellsFor(row)"
              :selected-id="selectedId"
              :motions="motions"
              @select="(id) => select(id, false)"
            />
          </ol>
          <p
            v-if="valueRows.length > SNIPPETS"
            class="mt-2 text-sm text-fg-muted"
          >
            {{ $t('review.moreRows', { n: number(valueRows.length - SNIPPETS) }, valueRows.length - SNIPPETS) }}
          </p>
        </div>
      </div>

      <div
        v-else
        id="view-row"
        role="tabpanel"
        aria-labelledby="view-tab-row"
        class="mt-2 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <div>
          <ol v-if="shownRows.length > 0">
            <ReviewRow
              v-for="row in shownRows"
              :key="row"
              :row="row"
              :cells="cellsFor(row)"
              :selected-id="selectedId"
              :motions="motions"
              @select="(id) => select(id)"
            />
          </ol>
          <p
            v-else
            class="mt-4 text-fg-muted"
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
          class="lg:mt-4"
          docked
          :finding="selected"
          :marking="marking"
          :problem="problem"
          @remove="decide('remove', $event)"
          @keep="decide('keep')"
          @undo="undo"
          @start-mark="startMark"
          @confirm-mark="confirmMark"
          @cancel-mark="marking = undefined"
        />
      </div>

      <div class="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6">
        <p class="max-w-measure text-sm text-fg-muted">
          {{ $t('review.limits') }}
        </p>
        <div class="flex flex-col items-end gap-3">
          <p
            v-if="counts.left > 0"
            class="text-sm text-fg-muted"
          >
            {{ $t('review.willRemove', { n: number(counts.left) }, counts.left) }}
          </p>
          <div class="flex flex-wrap justify-end gap-2">
            <button
              v-if="counts.left > 0"
              type="button"
              class="focus-ring press h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
              @click="removeLeft()"
            >
              {{ $t('review.removeAll', { n: number(counts.left) }) }}
            </button>
            <button
              v-if="checkingNames"
              type="button"
              disabled
              aria-describedby="download-waits"
              class="h-9 rounded-md bg-fg px-3.5 font-medium text-canvas opacity-50"
            >
              {{ $t('review.continue') }}
            </button>
            <NuxtLink
              v-else
              :to="localePath('/download')"
              class="focus-ring press inline-flex h-9 items-center rounded-md bg-fg px-3.5 font-medium text-canvas"
            >
              {{ $t('review.continue') }}
            </NuxtLink>
          </div>
          <p
            v-if="checkingNames"
            id="download-waits"
            class="text-sm text-fg-muted"
          >
            {{ $t('nameScan.downloadWaits') }}
          </p>
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
