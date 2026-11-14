<script setup lang="ts">
import { countsByColumn, itemsForColumns, textItems, type ColumnCounts } from '~~/core/items/table'

definePageMeta({ step: 1 })

const { t } = useI18n()
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

const journey = [['clean', true], ['find', false], ['decide', false]] as const
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

// On a small screen the two actions first suggest a laptop; Continue anyway
// runs the one that was tapped (SmallScreenSheet.vue).
const { suggestBiggerScreen, continued } = useSmallScreen()
const smallScreenSheet = useTemplateRef<{ open: () => void }>('smallScreenSheet')
let pending: (() => void) | undefined
function act(action: () => void) {
  if (!suggestBiggerScreen()) return action()
  pending = action
  smallScreenSheet.value?.open()
}
function onContinueAnyway() {
  continued.value = true
  pending?.()
  pending = undefined
}
const onChoose = () => act(() => input.value?.click())
const onSample = () => act(() => void openSample())

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
      class="grid flex-1 content-center gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:grid-rows-[auto_auto] lg:gap-x-16 lg:gap-y-0"
    >
      <div class="max-w-xl lg:col-start-1 lg:row-start-1 lg:self-end">
        <h1 class="text-2xl font-semibold text-balance sm:text-3xl">
          {{ $t('start.headline') }}
        </h1>
        <p class="mt-4 max-w-[52ch] text-md text-fg-muted">
          {{ $t('start.subline') }}
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="button"
            class="press focus-ring h-10 rounded-md bg-fg px-4 font-medium text-canvas hover:opacity-90"
            @click="onChoose"
          >
            {{ $t('start.choose') }}
          </button>
          <p class="text-sm">
            <button
              type="button"
              class="focus-ring rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              @click="onSample"
            >
              {{ $t('start.sampleButton') }}
            </button>
            <span class="block text-xs text-fg-muted">{{ $t('start.sampleNote') }}</span>
          </p>
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
        <p class="flex items-center gap-2 text-sm text-fg-muted lg:mt-6">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            class="size-4 shrink-0 fill-none stroke-current stroke-[1.6]"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><rect
            x="5"
            y="11"
            width="14"
            height="9"
            rx="2"
          /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          {{ $t('start.privacy') }}
        </p>
        <p class="mt-1 pl-6 text-sm text-fg-muted">
          {{ $t('start.privacyAi') }}
        </p>

        <!-- Not on phones: stacked, the three stages read as a stray list; the roadmap link in the footer covers it. -->
        <ol
          :aria-label="$t('start.journeyLabel')"
          class="mt-10 grid gap-4 border-t border-line pt-6 max-md:hidden sm:grid-cols-3"
        >
          <li
            v-for="[key, now] in journey"
            :key="key"
            class="flex flex-col gap-1.5"
          >
            <span
              class="self-start rounded-sm px-1.5 py-px text-xs font-medium"
              :class="now ? 'bg-accent text-on-accent' : 'border border-line text-fg-muted'"
            >{{ $t(`start.journey.${key}.when`) }}</span>
            <span
              class="text-sm"
              :class="now ? 'font-medium text-fg' : 'text-fg-muted'"
            >{{ $t(`start.journey.${key}.title`) }}</span>
          </li>
        </ol>
      </div>

      <SmallScreenSheet
        ref="smallScreenSheet"
        @continue="onContinueAnyway"
      />
    </section>

    <div
      v-else
      class="max-w-4xl"
    >
      <div class="grid items-start gap-x-10 gap-y-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
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
        <div class="min-w-0 space-y-1 text-sm text-fg-muted md:text-right">
          <p class="flex min-w-0 gap-1 text-fg md:justify-end">
            <MiddleTruncate :text="table.fileName" />
          </p>
          <p>{{ rowCount }}</p>
          <p v-if="isSample">
            {{ $t('file.sample') }}
          </p>
          <p v-if="table.raggedRows > 0">
            {{ $t('file.ragged', { n: number(table.raggedRows) }, table.raggedRows) }}
          </p>
          <label
            v-if="(table.sheetNames?.length ?? 0) > 1"
            class="flex items-center gap-2 md:justify-end"
          >
            <span>{{ $t('file.sheet') }}</span>
            <select
              class="focus-ring h-8 max-w-48 rounded-md border border-line-strong bg-canvas px-2 text-fg"
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
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            @click="chooseAnother"
          >
            {{ $t('file.chooseAnother') }}
          </button>
        </div>
      </div>

      <ColumnTable
        class="mt-8"
        :counts="columnCounts"
      />
      <PreviewTable class="mt-8" />
      <NameModelDownload class="mt-10" />

      <div
        class="sticky bottom-0 z-10 mt-8 -mb-8 border-t border-line bg-canvas py-4 sm:-mb-10"
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
  </div>
</template>
