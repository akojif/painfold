<script setup lang="ts">
import { PII_TYPES, type PiiType } from '~~/core/pii-types'
import { OverlapError, type Decision, type Finding, type Warning } from '~~/core/review/review'
import type { ItemSelection } from '~/utils/selection'
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
const { table, review, items, revision, placeOfUnit, itemsOfUnit } = session
// Names and places arrive in the background; the download waits for them.
const { busy: checkingNames } = useNameScan()

// By value: each distinct value once, decided for every copy. By row: the file as written.
const view = ref<'value' | 'row'>('value')
const onlyWithFindings = ref(false)
const selectedId = ref<number>()
// A warning is selected by its key; selecting one clears the selected finding and the other way round.
const selectedWarningKey = ref<string>()
const motions = shallowRef<ReadonlyMap<string, RemovalMotion>>(new Map())
const marking = ref<ItemSelection & { text: string }>()
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
const warnings = computed<readonly Warning[]>(() => (revision.value, [...(review.value?.warnings ?? [])]))
const selectedWarning = computed(() => warnings.value.find(warning => warning.key === selectedWarningKey.value))
const warningCounts = computed(() => (revision.value, review.value?.warningCounts() ?? { total: 0, removed: 0, dismissed: 0, open: 0 }))
const finished = computed(() => counts.value.total > 0 && counts.value.left === 0)

// One entry per distinct value, grouped by type, in order of first appearance within a type.
const values = computed<ValueEntry[]>(() => {
  const byKey = new Map<string, { finding: Finding, units: Set<string> }>()
  for (const finding of all.value) {
    const entry = byKey.get(finding.key)
    if (entry) entry.units.add(finding.unit)
    else byKey.set(finding.key, { finding, units: new Set([finding.unit]) })
  }
  return [...byKey.values()]
    .map(({ finding, units }) => ({ key: finding.key, type: finding.type, finding, units: units.size }))
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

// N and P step through values in the By value view and through findings in the
// By row view. Warnings come after the values, and in reading order among the findings.
type Item = { kind: 'finding', finding: Finding } | { kind: 'warning', warning: Warning }
const navigable = computed<Item[]>(() => {
  const warningItems = warnings.value.map(warning => ({ kind: 'warning' as const, warning }))
  if (view.value === 'value') return [...values.value.map(entry => ({ kind: 'finding' as const, finding: entry.finding })), ...warningItems]
  const where = (item: Item) => (item.kind === 'finding' ? item.finding : item.warning)
  const order = (item: Item) => review.value?.orderOf(where(item).item) ?? 0
  return [...all.value.map(finding => ({ kind: 'finding' as const, finding })), ...warningItems]
    .sort((a, b) => order(a) - order(b) || where(a).start - where(b).start)
})
const current = computed<Item | undefined>(() => {
  if (selectedWarning.value) return { kind: 'warning', warning: selectedWarning.value }
  return selected.value ? { kind: 'finding', finding: selected.value } : undefined
})
const position = (item?: Item) => navigable.value.findIndex((other) => {
  if (!item || other.kind !== item.kind) return false
  if (other.kind === 'warning') return other.warning.key === (item as typeof other).warning.key
  const finding = (item as typeof other).finding
  return view.value === 'value' ? other.finding.key === finding.key : other.finding.id === finding.id
})
const isPending = (item: Item) => item.kind === 'finding' ? !review.value?.decisionFor(item.finding.key) : !review.value?.warningDecisionFor(item.warning.key)

const warningsByItem = computed(() => {
  const byCell = new Map<string, Warning[]>()
  for (const warning of warnings.value) {
    byCell.set(warning.item, [...(byCell.get(warning.item) ?? []), warning])
  }
  return byCell
})

const findingsByItem = computed(() => {
  const byCell = new Map<string, Finding[]>()
  for (const finding of all.value) {
    byCell.set(finding.item, [...(byCell.get(finding.item) ?? []), finding])
  }
  return byCell
})

// Every unit (row) is shown by default: names can still be missed (and are
// not found at all without the name model), and units without findings are
// where they hide.
const unitIds = computed(() => {
  const everyUnit = items.value?.units.map(unit => unit.id) ?? []
  if (!onlyWithFindings.value) return everyUnit
  const marked = new Set([...all.value.map(finding => finding.unit), ...warnings.value.map(warning => warning.unit)])
  return everyUnit.filter(unit => marked.has(unit))
})
const shownUnits = computed(() => unitIds.value.slice(0, visibleCount.value))

// The units the selected value appears in, for the By value view.
const valueUnits = computed(() => {
  if (selectedWarning.value) return [selectedWarning.value.unit]
  const finding = selected.value
  if (!finding || !review.value) return []
  return [...new Set((revision.value, review.value.copiesOf(finding.key)).map(copy => copy.unit))]
})

/**
 * The items of a unit worth showing: the feedback text first, other free
 * text, and any item with a finding or warning. Labels show when there is
 * more than one, or when the one shown is not the feedback text.
 */
function itemsFor(unit: string) {
  const shown = [...itemsOfUnit(unit)]
    .sort((a, b) => Number(b.display === 'main') - Number(a.display === 'main'))
    .map(item => ({ item, findings: findingsByItem.value.get(item.id) ?? [], warnings: warningsByItem.value.get(item.id) ?? [] }))
    .filter(({ item, findings, warnings }) => item.display !== 'short' || findings.length > 0 || warnings.length > 0)
  return shown.map(({ item, findings, warnings }) => ({
    id: item.id,
    text: item.text,
    findings,
    warnings,
    label: shown.length > 1 || item.display !== 'main' ? item.label : undefined,
  }))
}

const heading = computed(() => t('review.heading', {
  findings: t('review.findings', { n: number(counts.value.total) }, counts.value.total),
  units: t('file.rows', { n: number(items.value?.units.length ?? 0) }, items.value?.units.length ?? 0),
}))
const progress = computed(() => (counts.value.total === 0 ? 1 : counts.value.reviewed / counts.value.total))

async function select(id: number | undefined, focus = true) {
  selectedId.value = id
  if (id !== undefined) selectedWarningKey.value = undefined
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
    const index = unitIds.value.indexOf(finding.unit)
    if (index >= visibleCount.value) visibleCount.value = index + BATCH
  }
  if (!focus) return
  await nextTick()
  const element = document.querySelector<HTMLElement>(target)
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: view.value === 'value' ? 'nearest' : 'center' })
}

async function selectWarning(key: string | undefined, focus = true) {
  selectedWarningKey.value = key
  selectedId.value = undefined
  problem.value = undefined
  const warning = selectedWarning.value
  if (!warning) return
  if (view.value === 'row') {
    const index = unitIds.value.indexOf(warning.unit)
    if (index >= visibleCount.value) visibleCount.value = index + BATCH
  }
  if (!focus) return
  await nextTick()
  const element = document.querySelector<HTMLElement>(view.value === 'value' ? `[data-warning-value="${key}"]` : `[data-warning="${key}"]`)
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: view.value === 'value' ? 'nearest' : 'center' })
}

function selectItem(item: Item | undefined, focus = true) {
  if (item?.kind === 'warning') selectWarning(item.warning.key, focus)
  else select(item?.finding.id, focus)
}

function step(direction: 1 | -1) {
  const list = navigable.value
  if (list.length === 0) return
  const index = position(current.value)
  const next = index === -1 ? (direction === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + direction))
  selectItem(list[next])
}

function nextPending(after: Item): Item | undefined {
  const list = navigable.value
  const index = position(after)
  return list.slice(index + 1).find(isPending) ?? list.slice(0, index).find(isPending)
}

/** Removes or keeps the selected warning: kept means dismissed, the text stays. */
function decideWarning(warning: Warning, decision: Decision, event?: MouseEvent) {
  session.change(current => current.decideWarning(warning.key, decision === 'remove' ? 'remove' : 'dismiss'))
  motions.value = decision === 'remove' ? new Map([[warning.key, motionFor(event)]]) : new Map()
  announcement.value = t(`warning.announce.${decision === 'remove' ? 'remove' : 'dismiss'}`, { left: number(warningCounts.value.open) })
  const next = nextPending({ kind: 'warning', warning })
  if (next) selectItem(next, view.value === 'row' || !event)
}

/** Decides the selected value or warning. Without a pointer event the decision came from the keyboard. */
function decide(decision: Decision, event?: MouseEvent) {
  if (selectedWarning.value) return decideWarning(selectedWarning.value, decision, event)
  const finding = selected.value
  if (!finding) return
  session.change(current => current.decide(finding.key, decision))
  motions.value = decision === 'remove' ? new Map([[finding.key, motionFor(event)]]) : new Map()
  announcement.value = t(`review.announce.${decision}`, { type: t(`typeOne.${finding.type}`), left: number(counts.value.left) })
  const next = nextPending({ kind: 'finding', finding })
  if (next) selectItem(next, view.value === 'row' || !event)
}

function undo() {
  const undone = session.change(current => current.undo())
  motions.value = new Map()
  announcement.value = t(undone ? 'review.announce.undo' : 'review.announce.nothingToUndo')
  if (selectedId.value && !selected.value) selectedId.value = undefined
  if (selectedWarningKey.value && !selectedWarning.value) selectedWarningKey.value = undefined
}

// Warnings are kept unless removed; removing all of them at once fades, like other bulk removals.
function removeWarnings() {
  const keys = warnings.value.filter(warning => !review.value?.warningDecisionFor(warning.key)).map(warning => warning.key)
  session.change(current => current.decideAllWarnings('remove'))
  motions.value = new Map(keys.map(key => [key, 'fade' as const]))
  announcement.value = t('warning.announce.removeAll')
}

// Bulk removals fade: a wipe across many tokens at once would be noise.
function removeLeft(type?: PiiType) {
  const keys = new Set(all.value.filter(finding => !review.value?.decisionFor(finding.key) && (!type || finding.type === type)).map(finding => finding.key))
  session.change(current => current.removeAllLeft(type))
  motions.value = new Map([...keys].map(key => [key, 'fade' as const]))
  announcement.value = type ? t('review.announce.removeType', { type: t(`typeManyLower.${type}`) }) : t('review.announce.removeAll')
}

function startMark() {
  const range = selectedItemRange(window.getSelection(), item => review.value?.textOf(item) ?? '')
  if (typeof range === 'string') {
    problem.value = t(`review.mark.${range}`)
    return
  }
  problem.value = undefined
  marking.value = { ...range, text: review.value!.textOf(range.item).slice(range.start, range.end) }
}

function confirmMark(type: PiiType) {
  const mark = marking.value
  if (!mark) return
  try {
    const added = session.change(current => current.markMissed(mark.item, mark.start, mark.end, type)) ?? []
    const marked = added.filter(finding => finding.source === 'marked')
    const forms = added.length - marked.length
    const units = new Set(marked.map(finding => finding.unit)).size
    announcement.value = [
      t('review.mark.done', { type: t(`typeOne.${type}`), n: units }, units),
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
  const onFinding = Boolean(target.closest('[data-finding], [data-value], [data-warning], [data-warning-value]'))
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
  if (selectedWarning.value) return selectWarning(selectedWarningKey.value, false)
  if (view.value === 'value' && selected.value) selectedId.value = values.value.find(entry => entry.key === selected.value!.key)?.finding.id
  select(selectedId.value, false)
})
watch(onlyWithFindings, () => (visibleCount.value = BATCH))

let observer: IntersectionObserver | undefined
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // Personal data first: warnings come after it in the list and never hold up the review.
  const first = navigable.value.find(item => item.kind === 'finding' && isPending(item)) ?? navigable.value[0]
  selectItem(first, false)
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
        <div class="text-sm text-fg-muted tabular-nums sm:text-right">
          <i18n-t
            keypath="review.progress"
            tag="p"
          >
            <template #reviewed>
              <span class="font-medium text-fg">{{ number(counts.reviewed) }}</span>
            </template>
            <template #left>
              {{ number(counts.left) }}
            </template>
          </i18n-t>
          <p v-if="warningCounts.open > 0">
            {{ $t('warning.toCheck', { n: number(warningCounts.open) }, warningCounts.open) }}
          </p>
        </div>
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
          v-if="values.length > 0 || warnings.length > 0"
          class="overflow-y-auto rounded-md border border-line bg-surface max-lg:max-h-[50vh] lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)]"
        >
          <ValueList
            class="pb-6"
            :groups="groups"
            :warnings="warnings"
            :selected-key="selected?.key"
            :selected-warning-key="selectedWarningKey"
            :motions="motions"
            @select="select($event, false)"
            @select-warning="selectWarning($event, false)"
            @remove-type="removeLeft($event)"
            @remove-warnings="removeWarnings"
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
            :warning="selectedWarning"
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
            v-if="valueUnits.length > 0"
            class="mt-6 border-t border-line"
          >
            <ReviewUnit
              v-for="unit in valueUnits.slice(0, SNIPPETS)"
              :key="unit"
              :place="placeOfUnit(unit)"
              :items="itemsFor(unit)"
              :selected-id="selectedId"
              :selected-warning-key="selectedWarningKey"
              :motions="motions"
              @select="(id) => select(id, false)"
              @select-warning="(key) => selectWarning(key, false)"
            />
          </ol>
          <p
            v-if="valueUnits.length > SNIPPETS"
            class="mt-2 text-sm text-fg-muted"
          >
            {{ $t('review.moreRows', { n: number(valueUnits.length - SNIPPETS) }, valueUnits.length - SNIPPETS) }}
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
          <ol v-if="shownUnits.length > 0">
            <ReviewUnit
              v-for="unit in shownUnits"
              :key="unit"
              :place="placeOfUnit(unit)"
              :items="itemsFor(unit)"
              :selected-id="selectedId"
              :selected-warning-key="selectedWarningKey"
              :motions="motions"
              @select="(id) => select(id)"
              @select-warning="(key) => selectWarning(key)"
            />
          </ol>
          <p
            v-else
            class="mt-4 text-fg-muted"
          >
            {{ $t('review.noRows') }}
          </p>
          <div
            v-if="shownUnits.length < unitIds.length"
            ref="sentinel"
            class="h-px"
          />
        </div>

        <MarginNote
          class="lg:mt-4"
          docked
          :finding="selected"
          :warning="selectedWarning"
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
