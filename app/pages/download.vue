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
// Largest first, in the summary and in the cleaning report.
const removed = computed(() => (revision.value, review.value ? [...removedByType(review.value)].sort((a, b) => b[1] - a[1]) : []))
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
      class="max-w-2xl"
    >
      <h1 class="text-xl font-semibold">
        {{ $t('download.heading') }}
      </h1>
      <p class="mt-1 truncate text-sm text-fg-muted">
        {{ table.fileName }}
      </p>

      <div class="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          class="focus-ring press h-10 max-w-full truncate rounded-md bg-fg px-4 font-medium text-canvas"
          @click="download"
        >
          {{ $t('download.button', { name: fileName }) }}
        </button>
        <button
          type="button"
          class="focus-ring press h-10 rounded-md border border-line px-4 hover:border-line-strong"
          @click="downloadReport"
        >
          {{ $t('download.reportButton') }}
        </button>
      </div>

      <section
        class="mt-10"
        aria-labelledby="removed-heading"
      >
        <h2
          id="removed-heading"
          class="text-sm font-medium"
        >
          {{ $t('download.removed') }}
        </h2>
        <dl
          v-if="removed.length > 0"
          class="mt-2 divide-y divide-line border-y border-line"
        >
          <div
            v-for="[type, count] in removed"
            :key="type"
            class="flex justify-between gap-6 py-2"
          >
            <dt>{{ $t(`typeMany.${type}`) }}</dt>
            <dd class="font-mono tabular-nums">
              {{ number(count) }}
            </dd>
          </div>
        </dl>
        <p
          v-else
          class="mt-2 text-fg-muted"
        >
          {{ $t('download.nothingRemoved') }}
        </p>
        <ul
          v-if="notReviewed > 0 || kept > 0 || dropped.length > 0 || unchecked.length > 0"
          class="mt-3 space-y-1 text-sm text-fg-muted"
        >
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
        <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <NuxtLink
            to="/review"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
          >
            {{ $t('download.back') }}
          </NuxtLink>
          <button
            type="button"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            @click="startOver"
          >
            {{ $t('download.startOver') }}
          </button>
        </div>
      </section>

      <div class="mt-10 space-y-2 text-sm text-fg-muted">
        <p>{{ $t('download.reportExplain') }}</p>
        <p>{{ $t('download.mapStays') }}</p>
        <p>{{ $t('review.limits') }}</p>
      </div>

      <section
        class="mt-10 border-t border-line pt-6"
        aria-labelledby="next-heading"
      >
        <h2
          id="next-heading"
          class="font-medium"
        >
          {{ $t('download.next.title') }}
        </h2>
        <p class="mt-1 text-fg-muted">
          {{ $t('download.next.body') }}
        </p>
        <a
          href="https://github.com/akojif/painfold/blob/main/ROADMAP.md"
          class="focus-ring mt-2 inline-block rounded-sm text-sm text-accent underline-offset-4 hover:underline"
        >
          {{ $t('download.next.link') }}
        </a>
      </section>
    </div>
  </ClientOnly>
</template>
