<script setup lang="ts">
import { DETECTED_TYPES } from '~~/core/detect'
import { ImportError, importFile, type ImportErrorCode } from '~~/core/import'

definePageMeta({ step: 1 })

const { t } = useI18n()
const { number, list } = useFormat()
const session = useSession()
const { table, isSample, feedbackColumn, scanColumns } = session
const detection = useDetection()

const reading = ref<string>()
const error = ref<ImportErrorCode>()
const detectionFailed = ref(false)
const detecting = ref(false)
const input = useTemplateRef<HTMLInputElement>('input')
const summary = useTemplateRef<HTMLElement>('summary')

// The file's bytes stay in memory so another sheet of a workbook can be read.
let lastFile: { name: string, bytes: Uint8Array } | undefined

const types = computed(() => list(DETECTED_TYPES.map(type => t(`types.${type}`))))
const rowCount = computed(() => t('file.rows', { n: number(table.value?.rows.length ?? 0) }, table.value?.rows.length ?? 0))

async function read(file: { name: string, bytes: Uint8Array }, options: { sheetName?: string, sample?: boolean } = {}) {
  reading.value = file.name
  error.value = undefined
  try {
    session.load(await importFile(file, { sheetName: options.sheetName }), options.sample)
    lastFile = file
    await nextTick()
    summary.value?.focus()
  }
  catch (caught) {
    error.value = caught instanceof ImportError ? caught.code : 'unreadable'
  }
  finally {
    reading.value = undefined
  }
}

async function onFile(file: File) {
  await read({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
}

function onInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file) onFile(file)
}

// Drop a file anywhere on the page while no file is open.
const { dragging } = useFileDrop(onFile, () => !table.value)

async function onSample() {
  // Bundled with the app and loaded on demand: no request leaves this site.
  const { default: text } = await import('~~/data/sample/support-tickets.csv?raw')
  await read({ name: 'support-tickets.csv', bytes: new TextEncoder().encode(text) }, { sample: true })
}

async function onSheet(event: Event) {
  if (lastFile) await read(lastFile, { sheetName: (event.target as HTMLSelectElement).value, sample: isSample.value })
}

async function chooseAnother() {
  session.clear()
  lastFile = undefined
  await nextTick()
  input.value?.click()
}

async function findPersonalData() {
  if (!table.value) return
  detecting.value = true
  detectionFailed.value = false
  try {
    session.findings.value = await detection.run(table.value.rows, scanColumns.value)
    await navigateTo('/review')
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
  <div>
    <template v-if="!table">
      <section class="grid items-center gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <div>
          <h1 class="max-w-[12ch] font-serif text-display-sm font-semibold md:text-display">
            {{ $t('start.headline') }}
          </h1>
          <p class="mt-6 max-w-[44ch] text-lg text-ink-muted">
            {{ $t('start.lead', { types }) }}
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button
              type="button"
              class="rounded-control bg-ink px-5 py-3 font-semibold text-desk outline-signal hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              @click="input?.click()"
            >
              {{ $t('start.choose') }}
            </button>
            <div>
              <button
                type="button"
                class="font-semibold text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
                @click="onSample"
              >
                {{ $t('start.sampleButton') }}
              </button>
              <p class="text-sm text-ink-muted">
                {{ $t('start.sampleNote') }}
              </p>
            </div>
          </div>
          <input
            ref="input"
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            class="hidden"
            data-testid="file-input"
            @change="onInputChange"
          >
          <p
            v-if="reading"
            class="mt-6"
            aria-live="polite"
          >
            {{ $t('start.reading', { name: reading }) }}
          </p>
          <div
            v-if="error"
            role="alert"
            class="mt-6 flex gap-3 border-l-4 border-alert pl-4 text-alert"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              class="mt-1 size-4 shrink-0 fill-current"
            ><path d="M8 1 15 14H1Z M7.25 6v4h1.5V6Zm0 5v1.5h1.5V11Z" /></svg>
            <p>{{ $t(`importErrors.${error}`) }}</p>
          </div>
          <div class="mt-10 border-t border-rule pt-5">
            <RemovedTypes />
          </div>
        </div>

        <div>
          <SpecimenSheet :lifted="dragging" />
          <p
            class="mt-6 text-center text-sm text-ink-muted"
            aria-live="polite"
          >
            {{ dragging ? $t('start.dropActive') : $t('start.dropAnywhere') }}
          </p>
        </div>
      </section>
    </template>

    <div
      v-else
      class="max-w-3xl space-y-8"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1
            ref="summary"
            tabindex="-1"
            class="text-xl font-semibold outline-none"
          >
            {{ $t('file.summary', { name: table.fileName, rows: rowCount }) }}
          </h1>
          <p
            v-if="isSample"
            class="text-sm text-ink-muted"
          >
            {{ $t('file.sample') }}
          </p>
          <p
            v-if="table.raggedRows > 0"
            class="text-sm text-ink-muted"
          >
            {{ $t('file.ragged', { n: number(table.raggedRows) }, table.raggedRows) }}
          </p>
        </div>
        <button
          type="button"
          class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="chooseAnother"
        >
          {{ $t('file.chooseAnother') }}
        </button>
      </div>

      <label
        v-if="(table.sheetNames?.length ?? 0) > 1"
        class="block"
      >
        <span class="block font-semibold">{{ $t('file.sheet') }}</span>
        <select
          class="mt-1 rounded-control border border-rule-strong bg-sheet px-3 py-1.5 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
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

      <label class="block">
        <span class="block font-semibold">{{ $t('columns.feedback') }}</span>
        <select
          class="mt-1 w-full max-w-sm rounded-control border border-rule-strong bg-sheet px-3 py-1.5 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
          :value="feedbackColumn"
          @change="session.setFeedbackColumn(Number(($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="(column, index) in table.columns"
            :key="column"
            :value="index"
          >
            {{ column }}
          </option>
        </select>
      </label>

      <ColumnRoles />
      <PreviewTable />

      <div class="space-y-4">
        <DetectionProgress
          v-if="detecting && detection.progress.value"
          :done="detection.progress.value.done"
          :total="detection.progress.value.total"
        />
        <p
          v-if="detectionFailed"
          role="alert"
          class="border-l-4 border-alert pl-4 text-alert"
        >
          {{ $t('find.failed') }}
        </p>
        <button
          type="button"
          class="rounded-control bg-signal px-4 py-2 font-semibold text-on-signal outline-signal hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
          :disabled="detecting"
          @click="findPersonalData"
        >
          {{ $t('find.button', { rows: rowCount }) }}
        </button>
      </div>
    </div>
  </div>
</template>
