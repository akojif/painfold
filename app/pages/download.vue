<script setup lang="ts">
import { cleanedFileName, cleanedTable, removedByType, reportFileName, toCsv } from '~~/core/export/csv'
import { cleaningReport, reportTimestamp } from '~~/core/export/report'

definePageMeta({
  step: 3,
  middleware: () => {
    if (import.meta.client && !useSession().review.value) return navigateTo('/')
  },
})

const { t } = useI18n()
const { number } = useFormat()
const session = useSession()
const { table, roles, review, revision } = session

const fileName = computed(() => cleanedFileName(table.value?.fileName ?? ''))
const removed = computed(() => (revision.value, review.value ? [...removedByType(review.value)] : []))
const notReviewed = computed(() => (revision.value, review.value?.counts().left ?? 0))
const kept = computed(() => (revision.value, review.value?.findings.filter(finding => review.value?.decisionFor(finding.key) === 'keep').length ?? 0))
const dropped = computed(() => table.value?.columns.filter((_, index) => roles.value[index] === 'drop') ?? [])
const unchecked = computed(() => table.value?.columns.filter((_, index) => roles.value[index] === 'keep') ?? [])

const { version } = useRuntimeConfig().public

function download() {
  if (!table.value || !review.value) return
  saveTextFile(fileName.value, toCsv(cleanedTable(table.value, roles.value, review.value), { delimiter: table.value.delimiter ?? ',' }))
}

function downloadReport() {
  if (!table.value) return
  const notes = [
    ...(notReviewed.value > 0 ? [t('download.notReviewed', { n: number(notReviewed.value) }, notReviewed.value)] : []),
    ...(kept.value > 0 ? [t('download.kept', { n: number(kept.value) }, kept.value)] : []),
    ...(dropped.value.length > 0 ? [t('download.dropped', { columns: dropped.value.join(', ') })] : []),
    ...(unchecked.value.length > 0 ? [t('download.unchecked', { columns: unchecked.value.join(', ') })] : []),
  ]
  const report = cleaningReport({
    title: t('report.title'),
    details: [
      [t('report.original'), table.value.fileName],
      [t('report.cleaned'), fileName.value],
      [t('report.rows'), number(table.value.rows.length)],
      [t('report.date'), reportTimestamp(new Date())],
      [t('report.version'), String(version)],
    ],
    removedHeading: t('report.removedHeading'),
    removed: removed.value.map(([type, count]) => [t(`typeMany.${type}`), number(count)]),
    nothingRemoved: t('report.nothingRemoved'),
    notes,
    limitsHeading: t('report.limitsHeading'),
    limits: t('review.limits'),
  })
  saveTextFile(reportFileName(table.value.fileName), report, 'text/plain;charset=utf-8')
}

async function startOver() {
  session.clear()
  await navigateTo('/')
}
</script>

<template>
  <ClientOnly>
    <div
      v-if="table && review"
      class="max-w-3xl"
    >
      <h1 class="font-serif text-3xl font-semibold">
        {{ $t('download.heading') }}
      </h1>
      <p class="mt-1 text-sm text-ink-muted">
        {{ table.fileName }}
      </p>

      <div class="paper mt-8 border border-rule bg-sheet px-7 py-6 text-ink shadow-sheet">
        <h2 class="text-sm text-ink-muted">
          {{ $t('download.removed') }}
        </h2>
        <dl
          v-if="removed.length > 0"
          class="mt-2 divide-y divide-rule"
        >
          <div
            v-for="[type, count] in removed"
            :key="type"
            class="flex justify-between gap-6 py-2"
          >
            <dt>{{ $t(`typeMany.${type}`) }}</dt>
            <dd class="font-semibold tabular-nums">
              {{ number(count) }}
            </dd>
          </div>
        </dl>
        <p
          v-else
          class="mt-2"
        >
          {{ $t('download.nothingRemoved') }}
        </p>
        <ul class="mt-4 space-y-1 border-t border-rule pt-4 text-sm text-ink-muted">
          <li v-if="notReviewed > 0">
            {{ $t('download.notReviewed', { n: number(notReviewed) }, notReviewed) }}
          </li>
          <li v-if="kept > 0">
            {{ $t('download.kept', { n: number(kept) }, kept) }}
          </li>
          <li v-if="dropped.length > 0">
            {{ $t('download.dropped', { columns: dropped.join(', ') }) }}
          </li>
          <li v-if="unchecked.length > 0">
            {{ $t('download.unchecked', { columns: unchecked.join(', ') }) }}
          </li>
        </ul>
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <button
          type="button"
          class="rounded-control bg-ink px-5 py-3 font-semibold text-desk outline-signal hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="download"
        >
          {{ $t('download.button', { name: fileName }) }}
        </button>
        <button
          type="button"
          class="rounded-control border border-rule-strong bg-sheet px-5 py-3 outline-signal hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="downloadReport"
        >
          {{ $t('download.reportButton') }}
        </button>
        <NuxtLink
          to="/review"
          class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {{ $t('download.back') }}
        </NuxtLink>
        <button
          type="button"
          class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="startOver"
        >
          {{ $t('download.startOver') }}
        </button>
      </div>

      <div class="mt-8 space-y-2 text-sm text-ink-muted">
        <p>{{ $t('download.reportExplain') }}</p>
        <p>{{ $t('download.mapStays') }}</p>
        <p class="max-w-[60ch] border-l-4 border-rule-strong pl-3">
          {{ $t('review.limits') }}
        </p>
      </div>
    </div>
  </ClientOnly>
</template>
