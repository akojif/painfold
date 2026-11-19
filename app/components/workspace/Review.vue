<script setup lang="ts">
// Review in the workspace (#141). By value: every distinct value, and every
// warning, as one row of a sortable table, narrowed with filters in the
// sidebar; the selected row's details and the rows it appears in sit in a
// drawer. N and P follow the table as filtered and sorted. By row: the file
// as written, with the selected finding's note beside it. N, P, R, K, M and Z
// work as before (useReviewWorkspace).
// The page renders this only once there is a review to show.
import type { PiiType } from '~~/core/pii-types'
import type { Warning } from '~~/core/review/review'
import type { ValueEntry } from '~/utils/value-list'

const ws = reactive(useReviewWorkspace())
const { t } = useI18n()
const { number } = useFormat()
const stats = useReviewStats(ws)

type Status = 'pending' | 'removed' | 'kept'
type Row
  = | { kind: 'value', key: string, type: string, value: string, rows: number, status: Status, order: number, entry: ValueEntry }
    | { kind: 'warning', key: string, type: 'WARNING', value: string, rows: number, status: Status, order: number, warning: Warning }

const STATUS_ORDER: Status[] = ['pending', 'removed', 'kept']
const STATUS_DOT: Record<Status, string> = { pending: 'bg-pending-line', removed: 'bg-token', kept: 'bg-line-strong' }

// Rows with a warning, and the rows each value appears in: for "In rows with a warning".
const warningUnits = computed(() => new Set(ws.warnings.map(warning => warning.unit)))
const unitsByKey = computed(() => {
  const byKey = new Map<string, Set<string>>()
  for (const finding of ws.all) byKey.set(finding.key, (byKey.get(finding.key) ?? new Set()).add(finding.unit))
  return byKey
})

const allRows = computed<Row[]>(() => {
  void ws.revision
  const valueRows = ws.values.map((entry, order): Row => ({ kind: 'value', key: entry.key, type: entry.type, value: entry.finding.value, rows: entry.units, status: stats.stateOf(entry.key), order, entry }))
  const warningRows = ws.warnings.map((warning, index): Row => {
    const decision = ws.review?.warningDecisionFor(warning.key)
    return { kind: 'warning', key: warning.key, type: 'WARNING', value: warning.value, rows: 1, status: decision === 'remove' ? 'removed' : decision === 'dismiss' ? 'kept' : 'pending', order: valueRows.length + index, warning }
  })
  return [...valueRows, ...warningRows]
})

// Filters: each group narrows the rows; a group's counts follow the other groups.
const filters = reactive({ type: [] as string[], status: [] as string[], warning: [] as string[] })
type FilterName = keyof typeof filters
const nearWarning = (row: Row) => row.kind === 'warning' || [...(unitsByKey.value.get(row.key) ?? [])].some(unit => warningUnits.value.has(unit))
const passes = (row: Row, skip?: FilterName) =>
  (skip === 'type' || filters.type.length === 0 || filters.type.includes(row.type))
  && (skip === 'status' || filters.status.length === 0 || filters.status.includes(row.status))
  && (skip === 'warning' || filters.warning.length === 0 || nearWarning(row))
const filtered = computed(() => filters.type.length + filters.status.length + filters.warning.length > 0)
function clearFilters() {
  filters.type = []
  filters.status = []
  filters.warning = []
}
const typeLabel = (type: string) => (type === 'WARNING' ? t('workspace.review.warnings') : t(`typeMany.${type}`))
const optionCount = (name: FilterName, match: (row: Row) => boolean) => allRows.value.filter(row => passes(row, name) && match(row)).length
const typeOptions = computed(() => [...new Set(allRows.value.map(row => row.type))].map(type => ({ key: type, label: typeLabel(type), count: optionCount('type', row => row.type === type) })))
const statusOptions = computed(() => STATUS_ORDER.map(status => ({ key: status, label: t(`workspace.review.status.${status}`), count: optionCount('status', row => row.status === status) })))
const warningOptions = computed(() => [{ key: 'near', label: t('workspace.review.nearWarning'), count: optionCount('warning', nearWarning) }])

// Sorting: by default the order of the values (by type, then warnings).
const sort = ref<{ column: string, direction: 'ascending' | 'descending' }>({ column: 'order', direction: 'ascending' })
function sortBy(column: string) {
  const same = sort.value.column === column
  sort.value = { column, direction: same && sort.value.direction === 'ascending' ? 'descending' : same ? 'ascending' : column === 'rows' ? 'descending' : 'ascending' }
}
const compare: Record<string, (a: Row, b: Row) => number> = {
  order: (a, b) => a.order - b.order,
  value: (a, b) => a.value.localeCompare(b.value),
  type: (a, b) => typeLabel(a.type).localeCompare(typeLabel(b.type)) || a.order - b.order,
  rows: (a, b) => a.rows - b.rows || b.order - a.order,
  status: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.order - b.order,
}
const rows = computed(() => {
  const list = allRows.value.filter(row => passes(row))
  const by = compare[sort.value.column] ?? compare.order!
  return list.sort((a, b) => (sort.value.direction === 'ascending' ? by(a, b) : by(b, a)))
})
// N and P, and the next value after a decision, follow the table as filtered and sorted.
watchEffect(() => {
  ws.valueOrder = rows.value.map(row => (row.kind === 'warning' ? `warning:${row.key}` : row.key))
})

// Long tables show a batch at a time; a value selected further down brings its batch in.
const BATCH = 200
const shown = ref(BATCH)
const shownRows = computed(() => rows.value.slice(0, shown.value))
watch(() => [filters.type, filters.status, filters.warning, sort.value], () => (shown.value = BATCH), { deep: true })

// Selection lives in the workspace; the drawer opens for it and closes with Escape.
const isSelected = (row: Row) => (row.kind === 'value' ? row.key === ws.selected?.key : row.key === ws.selectedWarningKey)
const selectedRow = computed(() => allRows.value.find(isSelected))
const hiddenByFilters = computed(() => Boolean(selectedRow.value) && !rows.value.includes(selectedRow.value!))
watch(selectedRow, (row) => {
  const index = row ? rows.value.indexOf(row) : -1
  if (index >= shown.value) shown.value = index + BATCH
})
// Where the details go: from 1,280 px a drawer docked beside the table, open for
// the selected value; from 1,024 px a drawer over the table's right side, opened
// by choosing a value; below that the note is a bar at the bottom (MarginNote)
// and where the value appears follows the table.
const wide = ref(false)
const docked = ref(false)
const drawerOpen = ref(false)
let queries: MediaQueryList[] = []
const measure = () => {
  wide.value = queries[0]?.matches ?? false
  docked.value = queries[1]?.matches ?? false
}
onMounted(() => {
  queries = [window.matchMedia('(min-width: 1024px)'), window.matchMedia('(min-width: 1280px)')]
  measure()
  for (const query of queries) query.addEventListener('change', measure)
  drawerOpen.value = docked.value
})
onBeforeUnmount(() => queries.forEach(query => query.removeEventListener('change', measure)))
watch(() => [ws.selectedId, ws.selectedWarningKey], () => {
  if (docked.value) drawerOpen.value = true
})

function pick(row: Row) {
  if (row.kind === 'value') ws.select(row.entry.finding.id, false)
  else ws.selectWarning(row.key, false)
  drawerOpen.value = true
}
function act(row: Row, decision: 'remove' | 'keep', event: MouseEvent) {
  pick(row)
  ws.decide(decision, event)
}
function closeDrawer() {
  if (ws.marking) return
  drawerOpen.value = false
  const row = selectedRow.value
  if (!row) return
  const target = row.kind === 'value' ? `[data-value="${row.entry.finding.id}"]` : `[data-warning-value="${row.key}"]`
  nextTick(() => document.querySelector<HTMLElement>(target)?.focus())
}

const placeholder = (row: Row) => (row.kind === 'value' ? ws.review!.placeholderFor(row.entry.finding) : ws.review!.placeholderForWarning(row.warning))
const shownText = (row: Row) => (row.status === 'removed' ? placeholder(row) : row.value)
const label = (row: Row) => row.kind === 'value'
  ? t('review.valueLabel', { type: t(`typeOne.${row.type}`), state: t(`review.state.${row.status === 'pending' ? 'pending' : row.status === 'removed' ? 'remove' : 'keep'}`), text: shownText(row) })
  : t('warning.valueLabel', { kind: t(`warning.kind.${row.warning.reason}`), n: ws.placeOfUnit(row.warning.unit).number, state: t(`warning.state.${row.status === 'pending' ? 'pending' : row.status === 'removed' ? 'remove' : 'dismiss'}`), text: shownText(row) })

const typeCell = (row: Row) => (row.kind === 'warning' ? t('workspace.review.warningType', { reason: t(`warning.short.${row.warning.reason}`) }) : t(`typeOne.${row.type}`))

const drawerTitle = computed(() => {
  const row = selectedRow.value
  if (!row) return ''
  return row.kind === 'value' ? t(`typeOne.${row.type}`) : t(`warning.kind.${row.warning.reason}`)
})
const drawerSub = computed(() => {
  const row = selectedRow.value
  if (!row) return undefined
  if (row.kind === 'warning') return t('workspace.review.warningRow', { n: number(ws.placeOfUnit(row.warning.unit).number) })
  return t('workspace.review.inRows', { n: number(row.rows) }, row.rows)
})

// Remove all: what is left, or with one type chosen in the filters, what is left of that type.
const onlyType = computed(() => (filters.type.length === 1 ? filters.type[0] : undefined))
const bulk = computed(() => {
  const type = onlyType.value
  if (type === 'WARNING') {
    const n = ws.warningCounts.open
    return n > 0 ? { label: t('warning.removeAllLabel', { n: number(n) }, n), run: () => ws.removeWarnings() } : undefined
  }
  if (type) {
    const n = ws.groups.find(group => group.type === type)?.pending ?? 0
    return n > 0 ? { label: t('review.removeAllOfType', { n: number(n), one: t(`typeOneLower.${type}`), many: t(`typeManyLower.${type}`) }, n), run: () => ws.removeLeft(type as PiiType) } : undefined
  }
  const n = ws.counts.left
  return n > 0 ? { label: t('review.removeAll', { n: number(n) }), run: () => ws.removeLeft() } : undefined
})
</script>

<template>
  <WorkspaceBody :sidebar-label="$t('workspace.review.sidebar')">
    <template #sidebar>
      <section
        v-if="ws.view === 'value'"
        aria-labelledby="review-filters"
        class="space-y-5"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h2
            id="review-filters"
            class="text-sm font-medium"
          >
            {{ $t('workspace.review.filters') }}
          </h2>
          <button
            v-if="filtered"
            type="button"
            class="focus-ring press rounded-sm text-sm text-accent underline-offset-4 hover:underline"
            @click="clearFilters"
          >
            {{ $t('workspace.review.clearFilters') }}
          </button>
        </div>
        <WorkspaceFacet
          v-model="filters.type"
          :legend="$t('workspace.review.type')"
          :options="typeOptions"
        />
        <WorkspaceFacet
          v-model="filters.status"
          :legend="$t('workspace.review.statusLegend')"
          :options="statusOptions"
        />
        <WorkspaceFacet
          v-if="ws.warnings.length > 0"
          v-model="filters.warning"
          :legend="$t('workspace.review.warnings')"
          :options="warningOptions"
        />
      </section>
      <section
        v-else
        aria-labelledby="review-filters"
        class="space-y-2"
      >
        <h2
          id="review-filters"
          class="text-sm font-medium"
        >
          {{ $t('workspace.review.filters') }}
        </h2>
        <label class="flex min-h-7 items-center gap-2 text-sm">
          <input
            v-model="ws.onlyWithFindings"
            type="checkbox"
            class="focus-ring size-4 accent-fg"
          >
          {{ $t('review.onlyWithFindings') }}
        </label>
      </section>

      <section
        aria-labelledby="review-names"
        class="space-y-2"
      >
        <h2
          id="review-names"
          class="text-sm font-medium"
        >
          {{ $t('workspace.review.names') }}
        </h2>
        <NameModelDownload compact />
        <NameScanStatus />
      </section>

      <!-- The privacy notice where people choose what leaves: the cleaned file or the analysis (#147). -->
      <div class="space-y-3 border-line text-sm md:col-span-2 lg:mt-auto lg:border-t lg:pt-4">
        <PrivacyNotice />
        <p class="text-fg-muted">
          {{ $t('review.limits') }}
        </p>
      </div>
    </template>

    <div
      class="grid min-w-0 flex-1 items-start"
      :class="ws.view === 'value' && drawerOpen && selectedRow ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : ''"
    >
      <!-- Below 1,024 px the note is a bar at the bottom: room for it under the last row. -->
      <div class="min-w-0 px-4 pt-6 pb-16 max-lg:pb-72 sm:px-6 lg:pt-8">
        <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div class="min-w-0">
            <h1 class="text-xl font-semibold">
              {{ ws.heading }}
            </h1>
            <MiddleTruncate
              class="mt-1 text-sm text-fg-muted"
              :text="ws.table!.fileName"
            />
            <div class="mt-2 text-sm text-fg-muted tabular-nums">
              <i18n-t
                keypath="review.progress"
                tag="p"
              >
                <template #reviewed>
                  <span class="font-medium text-fg">{{ number(ws.counts.reviewed) }}</span>
                </template>
                <template #left>
                  {{ number(ws.counts.left) }}
                </template>
              </i18n-t>
              <p v-if="ws.warningCounts.open > 0">
                {{ $t('warning.toCheck', { n: number(ws.warningCounts.open) }, ws.warningCounts.open) }}
              </p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex flex-wrap justify-end gap-2">
              <button
                v-if="bulk"
                type="button"
                class="focus-ring press h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
                @click="bulk.run"
              >
                {{ bulk.label }}
              </button>
              <ReviewNextActions :waiting="ws.checkingNames" />
            </div>
            <p
              v-if="ws.counts.left > 0"
              class="text-sm text-fg-muted"
            >
              {{ $t('review.willRemove', { n: number(ws.counts.left) }, ws.counts.left) }}
            </p>
            <p
              v-if="ws.checkingNames"
              id="download-waits"
              class="text-sm text-fg-muted"
            >
              {{ $t('nameScan.continueWaits') }}
            </p>
          </div>
        </div>
        <div
          role="progressbar"
          :aria-label="$t('review.progressLabel')"
          aria-valuemin="0"
          :aria-valuemax="ws.counts.total"
          :aria-valuenow="ws.counts.reviewed"
          class="mt-4 h-0.5 overflow-hidden rounded-full bg-line"
        >
          <div
            class="h-full origin-left bg-accent transition-transform duration-200 ease-out motion-reduce:transition-none"
            :style="{ transform: `scaleX(${ws.progress})` }"
          />
        </div>

        <div
          v-if="ws.finished && !ws.checkingNames"
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
                {{ $t('review.finished.body', { removed: number(ws.counts.total - ws.kept), kept: number(ws.kept) }) }}
                {{ $t('review.choice') }}
              </p>
            </div>
          </div>
          <ReviewNextActions :waiting="false" />
        </div>

        <div class="mt-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
          <div
            role="tablist"
            :aria-label="$t('review.views.label')"
            class="flex gap-5"
          >
            <button
              v-for="option in ws.views"
              :id="`view-tab-${option}`"
              :key="option"
              type="button"
              role="tab"
              :aria-selected="ws.view === option"
              :aria-controls="`view-${option}`"
              :tabindex="ws.view === option ? 0 : -1"
              class="focus-ring -mb-px rounded-t-sm border-b pb-2.5 text-sm"
              :class="ws.view === option ? 'border-fg font-medium text-fg' : 'border-transparent text-fg-muted hover:text-fg'"
              @click="ws.view = option"
              @keydown="ws.onTabKey"
            >
              {{ $t(option === 'value' ? 'review.views.byValue' : 'review.views.byRow') }}
            </button>
          </div>
          <p
            v-if="ws.view === 'value' && allRows.length > 0"
            class="mb-2.5 text-sm text-fg-muted tabular-nums"
          >
            {{ $t('workspace.review.shownOf', { shown: number(rows.length), total: number(allRows.length) }, allRows.length) }}
          </p>
          <p
            v-else-if="ws.view === 'row'"
            class="mb-2.5 text-sm text-fg-muted tabular-nums"
          >
            {{ $t('file.rows', { n: number(ws.unitIds.length) }, ws.unitIds.length) }}
          </p>
        </div>

        <p
          v-if="ws.counts.total === 0 && ws.warnings.length === 0"
          class="mt-6 text-fg-muted"
        >
          {{ $t('review.noFindings') }}
        </p>

        <div
          v-if="ws.view === 'value'"
          id="view-value"
          role="tabpanel"
          aria-labelledby="view-tab-value"
        >
          <template v-if="allRows.length > 0">
            <table class="mt-1 w-full table-fixed border-separate border-spacing-0 text-sm">
              <caption class="sr-only">
                {{ $t('workspace.review.caption') }}
              </caption>
              <colgroup>
                <col>
                <col class="w-32 lg:w-40">
                <col class="w-16">
                <col class="w-28">
                <col class="w-36">
              </colgroup>
              <thead>
                <tr>
                  <WorkspaceSortHeader
                    :label="$t('workspace.review.columns.value')"
                    column="value"
                    :sort="sort"
                    @sort="sortBy"
                  />
                  <WorkspaceSortHeader
                    :label="$t('workspace.review.type')"
                    column="type"
                    :sort="sort"
                    @sort="sortBy"
                  />
                  <WorkspaceSortHeader
                    :label="$t('workspace.review.columns.rows')"
                    column="rows"
                    numeric
                    :sort="sort"
                    @sort="sortBy"
                  />
                  <WorkspaceSortHeader
                    :label="$t('workspace.review.statusLegend')"
                    column="status"
                    :sort="sort"
                    @sort="sortBy"
                  />
                  <th
                    scope="col"
                    class="sticky top-14 z-10 border-b border-line bg-canvas px-3 text-right text-xs font-medium text-fg-muted"
                  >
                    {{ $t('workspace.review.columns.decision') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in shownRows"
                  :key="row.key"
                  class="cursor-pointer"
                  :class="isSelected(row) ? 'bg-tint' : 'hover:bg-tint/60'"
                  @click="pick(row)"
                >
                  <td class="relative h-10 border-b border-line px-3">
                    <span
                      v-if="isSelected(row)"
                      aria-hidden="true"
                      class="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent"
                    />
                    <button
                      type="button"
                      :data-value="row.kind === 'value' ? row.entry.finding.id : undefined"
                      :data-warning-value="row.kind === 'warning' ? row.key : undefined"
                      :aria-label="label(row)"
                      :aria-current="isSelected(row) ? 'true' : undefined"
                      class="focus-ring flex max-w-full min-w-0 rounded-sm text-left"
                      @click.stop="pick(row)"
                    >
                      <RedactionToken
                        v-if="row.status === 'removed'"
                        :placeholder="placeholder(row)"
                        :motion="ws.motions.get(row.key)"
                      />
                      <span
                        v-else-if="row.kind === 'warning'"
                        class="min-w-0 truncate font-mono underline decoration-1 underline-offset-4"
                        :class="row.status === 'kept' ? 'text-fg-muted decoration-line-strong decoration-dotted' : 'decoration-danger decoration-dashed'"
                      >{{ row.value }}</span>
                      <span
                        v-else
                        class="flex min-w-0 font-mono"
                        :class="row.status === 'kept'
                          ? 'text-fg-muted underline decoration-line-strong decoration-dotted underline-offset-4'
                          : 'rounded-sm bg-pending px-1 text-on-pending underline decoration-pending-line underline-offset-4'"
                      >
                        <MiddleTruncate
                          v-if="row.type === 'URL'"
                          :text="row.value"
                          :tail="16"
                        />
                        <span
                          v-else
                          class="truncate"
                        >{{ row.value }}</span>
                      </span>
                    </button>
                  </td>
                  <td
                    class="truncate border-b border-line px-3 text-fg-muted"
                    :title="typeCell(row)"
                  >
                    {{ typeCell(row) }}
                  </td>
                  <td class="border-b border-line px-3 text-right font-mono tabular-nums">
                    {{ number(row.rows) }}
                  </td>
                  <td class="border-b border-line px-3">
                    <span class="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        class="size-1.5 shrink-0 rounded-full"
                        :class="STATUS_DOT[row.status]"
                      />
                      {{ $t(`workspace.review.status.${row.status}`) }}
                    </span>
                  </td>
                  <td class="border-b border-line px-2 text-right">
                    <span class="inline-flex gap-1">
                      <button
                        type="button"
                        tabindex="-1"
                        class="focus-ring press h-7 rounded-sm px-2 text-sm"
                        :class="row.status === 'removed' ? 'bg-token font-medium text-on-token' : 'text-fg-muted hover:bg-canvas hover:text-fg'"
                        :aria-pressed="row.status === 'removed'"
                        :aria-label="`${$t('review.remove')}: ${shownText(row)}`"
                        @click.stop="act(row, 'remove', $event)"
                      >
                        {{ $t('review.remove') }}
                      </button>
                      <button
                        type="button"
                        tabindex="-1"
                        class="focus-ring press h-7 rounded-sm px-2 text-sm"
                        :class="row.status === 'kept' ? 'bg-canvas font-medium text-fg shadow-raised' : 'text-fg-muted hover:bg-canvas hover:text-fg'"
                        :aria-pressed="row.status === 'kept'"
                        :aria-label="`${$t('review.keep')}: ${shownText(row)}`"
                        @click.stop="act(row, 'keep', $event)"
                      >
                        {{ $t('review.keep') }}
                      </button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <button
              v-if="shownRows.length < rows.length"
              type="button"
              class="focus-ring press mt-3 rounded-sm text-sm text-accent underline-offset-4 hover:underline"
              @click="shown += BATCH"
            >
              {{ $t('review.showMoreOfType', { n: number(Math.min(BATCH, rows.length - shownRows.length)) }) }}
            </button>
            <div
              v-if="rows.length === 0"
              class="border-b border-line px-3 py-10 text-center text-sm text-fg-muted"
            >
              <p>{{ $t('workspace.review.noMatch') }}</p>
              <button
                type="button"
                class="focus-ring press mt-2 rounded-sm text-accent underline-offset-4 hover:underline"
                @click="clearFilters"
              >
                {{ $t('workspace.review.clearFilters') }}
              </button>
            </div>
            <p class="mt-3 text-sm text-fg-muted">
              {{ $t('workspace.review.keys') }}
            </p>
            <template v-if="!wide">
              <MarginNote
                :finding="ws.selected"
                :warning="ws.selectedWarning"
                :marking="ws.marking"
                :problem="ws.problem"
                @remove="ws.decide('remove', $event)"
                @keep="ws.decide('keep')"
                @undo="ws.undo"
                @start-mark="ws.startMark"
                @confirm-mark="ws.confirmMark"
                @cancel-mark="ws.marking = undefined"
              />
              <section
                v-if="ws.valueUnits.length > 0"
                aria-labelledby="where-it-appears"
                class="mt-8"
              >
                <h2
                  id="where-it-appears"
                  class="border-b border-line pb-2 text-sm font-medium"
                >
                  {{ $t('workspace.review.whereItAppears') }}
                </h2>
                <ol>
                  <ReviewUnit
                    v-for="unit in ws.valueUnits.slice(0, ws.SNIPPETS)"
                    :key="unit"
                    :place="ws.placeOfUnit(unit)"
                    :items="ws.itemsFor(unit)"
                    :selected-id="ws.selectedId"
                    :selected-warning-key="ws.selectedWarningKey"
                    :motions="ws.motions"
                    @select="(id) => ws.select(id, false)"
                    @select-warning="(key) => ws.selectWarning(key, false)"
                  />
                </ol>
              </section>
            </template>
          </template>
        </div>

        <div
          v-else
          id="view-row"
          role="tabpanel"
          aria-labelledby="view-tab-row"
          class="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
        >
          <div class="min-w-0 rounded-md border border-line bg-surface px-4">
            <ol v-if="ws.shownUnits.length > 0">
              <ReviewUnit
                v-for="unit in ws.shownUnits"
                :key="unit"
                :place="ws.placeOfUnit(unit)"
                :items="ws.itemsFor(unit)"
                :selected-id="ws.selectedId"
                :selected-warning-key="ws.selectedWarningKey"
                :motions="ws.motions"
                @select="(id) => ws.select(id)"
                @select-warning="(key) => ws.selectWarning(key)"
              />
            </ol>
            <p
              v-else
              class="py-4 text-fg-muted"
            >
              {{ $t('review.noRows') }}
            </p>
            <div
              v-if="ws.shownUnits.length < ws.unitIds.length"
              :ref="(element) => (ws.sentinel = element as HTMLElement)"
              class="h-px"
            />
          </div>

          <MarginNote
            class="lg:rounded-md lg:border lg:border-line lg:bg-surface lg:p-4"
            docked
            :finding="ws.selected"
            :warning="ws.selectedWarning"
            :marking="ws.marking"
            :problem="ws.problem"
            @remove="ws.decide('remove', $event)"
            @keep="ws.decide('keep')"
            @undo="ws.undo"
            @start-mark="ws.startMark"
            @confirm-mark="ws.confirmMark"
            @cancel-mark="ws.marking = undefined"
          />
        </div>
      </div>

      <WorkspaceDrawer
        v-if="ws.view === 'value' && wide"
        :open="drawerOpen && Boolean(selectedRow)"
        :title="drawerTitle"
        :sub="drawerSub"
        @close="closeDrawer"
      >
        <p
          v-if="hiddenByFilters"
          class="mb-3 rounded-md bg-tint px-3 py-2 text-sm text-fg-muted"
        >
          {{ $t('workspace.review.hidden') }}
        </p>
        <MarginNote
          :finding="ws.selected"
          :warning="ws.selectedWarning"
          :marking="ws.marking"
          :problem="ws.problem"
          @remove="ws.decide('remove', $event)"
          @keep="ws.decide('keep')"
          @undo="ws.undo"
          @start-mark="ws.startMark"
          @confirm-mark="ws.confirmMark"
          @cancel-mark="ws.marking = undefined"
        />
        <template v-if="ws.valueUnits.length > 0">
          <h3 class="mt-6 border-b border-line pb-2 text-sm font-medium">
            {{ $t('workspace.review.whereItAppears') }}
          </h3>
          <ol>
            <ReviewUnit
              v-for="unit in ws.valueUnits.slice(0, ws.SNIPPETS)"
              :key="unit"
              :place="ws.placeOfUnit(unit)"
              :items="ws.itemsFor(unit)"
              :selected-id="ws.selectedId"
              :selected-warning-key="ws.selectedWarningKey"
              :motions="ws.motions"
              @select="(id) => ws.select(id, false)"
              @select-warning="(key) => ws.selectWarning(key, false)"
            />
          </ol>
          <p
            v-if="ws.valueUnits.length > ws.SNIPPETS"
            class="mt-2 text-sm text-fg-muted"
          >
            {{ $t('review.moreRows', { n: number(ws.valueUnits.length - ws.SNIPPETS) }, ws.valueUnits.length - ws.SNIPPETS) }}
          </p>
        </template>
      </WorkspaceDrawer>
    </div>

    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ ws.announcement }}
    </p>
  </WorkspaceBody>
</template>
