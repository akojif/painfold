<script setup lang="ts">
import { countsByColumn, itemsForColumns, textItems, type ColumnCounts } from '~~/core/items/table'

// Once a file is open, the column step is the first page of the workspace (#141).
definePageMeta({ step: 1, workspace: true })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { number } = useFormat()
const session = useSession()
const { table, isSample, roles, review, columnsChanged } = session
const mayDiscard = useDiscardGuard()
const { confirm } = useConfirm()
const detection = useDetection()
// Set up here, before the review starts, so names are checked as soon as it does.
useNameScan()

const { reading, openSample, openSheet, openPicked } = useOpenFile()
const detectionFailed = ref(false)
const detecting = ref(false)
const input = useTemplateRef<HTMLInputElement>('input')
const summary = useTemplateRef<HTMLElement>('summary')

const columnCounts = shallowRef<readonly ColumnCounts[]>()
const cleanedSummary = computed(() => {
  const count = (role: string) => roles.value.filter(current => current === role).length
  const [checked, kept, dropped] = [count('scan'), count('keep'), count('drop')]
  return t('columns.summary', {
    columns: t('columns.columnCount', { n: number(checked + kept) }, checked + kept),
    checked: number(checked),
    kept: number(kept),
    dropped: number(dropped),
  })
})

// Once a file is open, the worker counts the personal data in every column, so
// a column kept as is can be flagged before anything is reviewed. Only counts
// come back, never values.
watch(table, async (current) => {
  columnCounts.value = undefined
  if (!current) return
  try {
    const surveyed = itemsForColumns(current, current.columns.map((_, index) => index))
    const counts = await detection.survey(textItems(surveyed))
    if (table.value === current) columnCounts.value = countsByColumn(surveyed, counts)
  }
  catch {
    // Without the survey there are no warnings; checking still works as before.
  }
})

const rowCount = computed(() => t('file.rows', { n: number(table.value?.rows.length ?? 0) }, table.value?.rows.length ?? 0))

/** Columns where the rules found personal data, most first, with what happens to each. */
const personalColumns = computed(() => (columnCounts.value ?? [])
  .map(entry => ({ column: entry.column, total: Object.values(entry.counts).reduce((sum, count) => sum + (count ?? 0), 0) }))
  .filter(entry => entry.total > 0)
  .sort((a, b) => b.total - a.total)
  .map(entry => ({ ...entry, name: table.value?.columns[entry.column] ?? '', role: roles.value[entry.column] })))

// A newly opened file moves focus to the column step's heading, so keyboard and screen reader users start there.
watch(table, async (now, before) => {
  if (!now || now === before) return
  await nextTick()
  summary.value?.focus()
})

function onInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file) void openPicked(file)
}

// On a small screen the two actions open the note that Painfold needs a
// bigger screen instead (SmallScreenSheet.vue, #139).
const { narrow } = useSmallScreen()
const smallScreenSheet = useTemplateRef<{ open: () => void }>('smallScreenSheet')
function act(action: () => void) {
  if (narrow.value) smallScreenSheet.value?.open()
  else action()
}
const onChoose = () => act(() => input.value?.click())
// "Try an example" (ExampleDialog.vue): clean the sample file step by step, or
// see the demo report (#130), a stored real run on the sample, without
// importing or reviewing. Loading the demo sends nothing.
const exampleDialog = useTemplateRef<{ open: () => void }>('exampleDialog')
const onExample = () => act(() => exampleDialog.value?.open())
const tagging = useTagging()
const onSample = () => void openSample()
const onDemo = () => void tagging.loadDemo(locale.value === 'de' ? 'de' : 'en').then(() => navigateTo(localePath('/report')))

function onSheet(event: Event) {
  void openSheet((event.target as HTMLSelectElement).value)
}

async function chooseAnother() {
  if (!(await mayDiscard())) return
  session.clear()
  await nextTick()
  input.value?.click()
}

// Back from the review with the same columns: the review, and every decision in it, is still there.
const backToReview = computed(() => Boolean(review.value) && !columnsChanged.value)

async function findPersonalData() {
  if (!table.value) return
  if (backToReview.value) {
    await navigateTo(localePath('/review'))
    return
  }
  // Changed columns mean a new review; ask first if decisions would be lost.
  if (review.value && review.value.counts().reviewed > 0) {
    const reset = await confirm({ title: t('resetReview.title'), body: t('resetReview.body'), confirm: t('resetReview.confirm'), cancel: t('resetReview.cancel') })
    if (!reset) return
  }
  detecting.value = true
  detectionFailed.value = false
  try {
    const set = session.itemsToCheck()!
    session.startReview(set, await detection.run(textItems(set.items)))
    await navigateTo(localePath('/review'))
  }
  catch {
    detectionFailed.value = true
  }
  finally {
    detecting.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <input
      ref="input"
      type="file"
      accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="hidden"
      data-testid="file-input"
      @change="onInputChange"
    >

    <!-- One grid: on small screens headline, actions, example, then the rest; from lg two columns, the example on the right. -->
    <section
      v-if="!table"
      class="grid flex-1 content-center gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:grid-rows-[auto_auto_auto] lg:gap-x-16 lg:gap-y-0"
    >
      <div class="max-w-xl lg:col-start-1 lg:row-start-1 lg:self-end">
        <h1 class="text-2xl font-semibold text-balance sm:text-3xl">
          {{ $t('start.headline') }}
        </h1>
        <p class="mt-4 max-w-[52ch] text-md text-fg-muted">
          {{ $t('start.subline') }}
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="press focus-ring h-10 rounded-md bg-fg px-4 font-medium text-canvas hover:opacity-90"
            @click="onChoose"
          >
            {{ $t('start.choose') }}
          </button>
          <button
            type="button"
            class="press focus-ring h-10 rounded-md border border-line-strong px-4 font-medium hover:border-fg"
            @click="onExample"
          >
            {{ $t('start.example.button') }}
          </button>
        </div>

        <p
          v-if="reading"
          class="mt-5 text-sm text-fg-muted"
          aria-live="polite"
        >
          {{ $t('start.reading', { name: reading }) }}
        </p>
      </div>

      <ExamplePanel class="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center" />

      <div class="max-w-xl lg:col-start-1 lg:row-start-2 lg:self-start">
        <PrivacyNotice class="lg:mt-6" />
      </div>

      <!-- Not on phones: stacked, the three steps read as a stray list; the roadmap link in the footer covers it. -->
      <WhatPainfoldDoes class="mt-4 max-md:hidden lg:col-span-2 lg:row-start-3 lg:mt-16" />

      <SmallScreenSheet ref="smallScreenSheet" />
      <ExampleDialog
        ref="exampleDialog"
        @sample="onSample"
        @demo="onDemo"
      />
    </section>

    <WorkspaceBody
      v-else
      :sidebar-label="$t('workspace.importSidebar')"
    >
      <template #sidebar>
        <section aria-labelledby="sidebar-file">
          <h2
            id="sidebar-file"
            class="text-sm font-medium"
          >
            {{ $t('file.heading') }}
          </h2>
          <p class="mt-1.5 flex min-w-0 text-sm">
            <MiddleTruncate :text="table.fileName" />
          </p>
          <dl class="mt-2 space-y-1 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-fg-muted">
                {{ $t('file.rowsLabel') }}
              </dt>
              <dd class="font-mono tabular-nums">
                {{ number(table.rows.length) }}
              </dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-fg-muted">
                {{ $t('file.columnsLabel') }}
              </dt>
              <dd class="font-mono tabular-nums">
                {{ number(table.columns.length) }}
              </dd>
            </div>
          </dl>
          <p
            v-if="isSample"
            class="mt-2 text-sm text-fg-muted"
          >
            {{ $t('file.sample') }}
          </p>
          <p
            v-if="table.raggedRows > 0"
            class="mt-2 text-sm text-fg-muted"
          >
            {{ $t('file.ragged', { n: number(table.raggedRows) }, table.raggedRows) }}
          </p>
          <label
            v-if="(table.sheetNames?.length ?? 0) > 1"
            class="mt-2 flex items-center gap-2 text-sm"
          >
            <span class="text-fg-muted">{{ $t('file.sheet') }}</span>
            <select
              class="focus-ring h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-canvas px-2 text-fg"
              :value="table.sheetName"
              @change="onSheet"
            >
              <option
                v-for="sheet in table.sheetNames"
                :key="sheet"
                :value="sheet"
              >
                {{ sheet }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="press focus-ring mt-2 rounded-sm text-sm text-accent underline-offset-4 hover:underline"
            @click="chooseAnother"
          >
            {{ $t('file.chooseAnother') }}
          </button>
        </section>

        <section aria-labelledby="sidebar-personal">
          <h2
            id="sidebar-personal"
            class="text-sm font-medium"
          >
            {{ $t('columns.byColumn.heading') }}
          </h2>
          <p
            v-if="!columnCounts"
            class="mt-1.5 text-sm text-fg-muted"
          >
            {{ $t('columns.byColumn.counting') }}
          </p>
          <p
            v-else-if="personalColumns.length === 0"
            class="mt-1.5 text-sm text-fg-muted"
          >
            {{ $t('columns.byColumn.none') }}
          </p>
          <ul
            v-else
            class="mt-1.5 space-y-1 text-sm"
          >
            <li
              v-for="entry in personalColumns"
              :key="entry.column"
              class="flex items-baseline justify-between gap-2"
            >
              <span class="min-w-0 truncate">{{ entry.name }}</span>
              <span class="shrink-0 text-xs text-fg-muted">
                <span
                  v-if="entry.role !== 'scan'"
                  :class="entry.role === 'keep' ? 'text-danger' : ''"
                >{{ $t(`columns.roles.${entry.role}`) }}</span>
                <span class="ml-1.5 font-mono tabular-nums">{{ number(entry.total) }}</span>
              </span>
            </li>
          </ul>
        </section>
      </template>

      <div class="flex flex-1 flex-col px-4 pt-6 sm:px-6 lg:pt-8">
        <div class="max-w-measure">
          <h1
            ref="summary"
            tabindex="-1"
            class="text-xl font-semibold outline-none"
          >
            {{ $t('columns.heading') }}
          </h1>
          <p class="mt-2 text-sm text-fg-muted">
            {{ $t('columns.help') }}
          </p>
        </div>

        <ColumnTable
          class="mt-8"
          :counts="columnCounts"
        />
        <PreviewTable class="mt-8" />
        <NameModelDownload class="mt-10" />

        <div
          class="sticky bottom-0 z-10 mt-8 border-t border-line bg-canvas py-4"
          data-toast-avoid
        >
          <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p
              class="text-sm text-fg-muted tabular-nums"
              aria-live="polite"
            >
              {{ cleanedSummary }}
            </p>
            <button
              type="button"
              class="press focus-ring h-10 rounded-md bg-fg px-4 font-medium text-canvas hover:opacity-90 disabled:opacity-50 max-sm:w-full"
              :disabled="detecting"
              @click="findPersonalData"
            >
              {{ backToReview ? $t('find.continue') : $t('find.button', { rows: rowCount }) }}
            </button>
          </div>
          <p
            v-if="columnsChanged"
            class="mt-3 text-sm text-fg-muted"
          >
            {{ $t('find.columnsChanged') }}
          </p>
          <DetectionProgress
            v-if="detecting && detection.progress.value"
            class="mt-3"
            :done="detection.progress.value.done"
            :total="detection.progress.value.total"
          />
          <p
            v-if="detectionFailed"
            role="alert"
            class="mt-3 text-sm text-danger"
          >
            {{ $t('find.failed') }}
          </p>
        </div>
      </div>
    </WorkspaceBody>
  </div>
</template>
