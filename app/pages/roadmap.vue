<script setup lang="ts">
// What Painfold does now and what comes next, from app/utils/roadmap-items.ts:
// the released versions, then the work in four columns. No dates ahead: only
// released versions have one.
const { t } = useI18n()
const { list, number } = useFormat()
useHead({ title: () => `${t('roadmap.title')}, ${t('app.name')}` })

const items = shallowRef<readonly RoadmapItem[]>(ROADMAP_ITEMS)

// Development only: /roadmap/?fixture=large shows a long invented roadmap,
// to check the page as it grows. Production builds leave it out.
if (import.meta.dev) {
  const route = useRoute()
  const { mergeLocaleMessage } = useI18n()
  onMounted(async () => {
    if (route.query.fixture !== 'large') return
    const fixture = await import('~~/tests/fixtures/roadmap-large')
    for (const [locale, messages] of Object.entries(fixture.messages)) mergeLocaleMessage(locale, messages)
    items.value = fixture.items
  })
}

const summary = computed(() => {
  const counts = statusCounts(items.value)
  return t('roadmap.summary', {
    version: releasesOf(items.value)[0]?.version ?? '',
    counts: list([
      t('roadmap.counts.inProgress', { n: number(counts.inProgress) }, counts.inProgress),
      t('roadmap.counts.planned', { n: number(counts.planned) }, counts.planned),
      t('roadmap.counts.idea', { n: number(counts.idea) }, counts.idea),
    ]),
  })
})
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold">
      {{ $t('roadmap.title') }}
    </h1>
    <p class="mt-2 max-w-measure text-md text-fg-muted">
      {{ $t('roadmap.intro') }}
    </p>
    <p class="mt-3 text-sm">
      {{ summary }}
    </p>

    <RoadmapReleases
      class="mt-8"
      :items="items"
    />

    <!-- Now and Next share the first column: both are short and come first, so the
         longer Later and Ideas get a column each. On a phone the order is the same. -->
    <div class="mt-10 grid items-start gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      <div class="space-y-10">
        <RoadmapColumn
          v-for="column in COLUMNS.slice(0, 2)"
          :key="column"
          :column="column"
          :items="columnOf(items, column)"
        />
      </div>
      <RoadmapColumn
        v-for="column in COLUMNS.slice(2)"
        :key="column"
        :column="column"
        :items="columnOf(items, column)"
      />
    </div>

    <a
      :href="ROADMAP_URL"
      class="focus-ring mt-10 inline-block rounded-sm text-sm text-accent underline-offset-4 hover:underline"
    >
      {{ $t('roadmap.full') }}
    </a>
  </div>
</template>
