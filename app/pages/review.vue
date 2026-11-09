<script setup lang="ts">
definePageMeta({
  step: 2,
  // Nothing to review without a checked file; this runs in the browser only.
  middleware: () => {
    if (import.meta.client && !useSession().findings.value) return navigateTo('/')
  },
})

const { t } = useI18n()
const { number } = useFormat()
const { table, findings } = useSession()

const findingCount = computed(() => findings.value?.reduce((sum, cell) => sum + cell.detections.length, 0) ?? 0)
const heading = computed(() => t('review.heading', {
  findings: t('review.findings', { n: number(findingCount.value) }, findingCount.value),
  rows: t('file.rows', { n: number(table.value?.rows.length ?? 0) }, table.value?.rows.length ?? 0),
}))
</script>

<template>
  <ClientOnly>
    <div v-if="findings && table">
      <h1 class="font-serif text-3xl font-semibold">
        {{ heading }}
      </h1>
      <p class="mt-1 text-sm text-ink-muted">
        {{ table.fileName }}
      </p>
    </div>
  </ClientOnly>
</template>
