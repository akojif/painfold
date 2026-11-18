<script setup lang="ts">
// Variation C: a ledger by version, like a changelog that also covers what is
// ahead. Upcoming versions first, then work without a version, ideas, and the
// releases, newest first. A filter narrows it to one status.
const { date } = useFormat()
const { t } = useI18n()
const filter = ref<ItemStatus | 'all'>('all')

const groups = computed(() => {
  const keep = (items: RoadmapItem[]) => items.filter(item => filter.value === 'all' || item.status === filter.value)
  const ahead = upcomingByVersion().map(group => ({ key: group.version ?? 'none', label: group.version ?? t('roadmap.noVersion'), mono: Boolean(group.version), items: keep(group.items) }))
  const ideas = { key: 'idea', label: t('roadmap.horizons.idea.name'), mono: false, items: keep(ROADMAP_ITEMS.filter(item => item.status === 'idea')) }
  const released = [...ROADMAP_ITEMS.filter(item => item.status === 'released')].reverse()
    .map(item => ({ key: item.version!, label: item.version!, mono: true, items: keep([item]) }))
  return [...ahead, ideas, ...released].filter(group => group.items.length > 0)
})
const options = ['all', ...ITEM_STATUSES] as const
</script>

<template>
  <div class="mt-8 max-w-3xl">
    <fieldset class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <legend class="sr-only">
        {{ $t('roadmap.filterLabel') }}
      </legend>
      <span
        aria-hidden="true"
        class="text-sm text-fg-muted"
      >{{ $t('roadmap.filterLabel') }}</span>
      <div class="inline-flex flex-wrap rounded-md border border-line bg-surface p-0.5">
        <label
          v-for="option in options"
          :key="option"
          class="press cursor-pointer rounded-sm px-2.5 py-1 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent"
          :class="filter === option ? 'bg-canvas font-medium text-fg shadow-raised' : 'text-fg-muted hover:text-fg'"
        >
          <input
            v-model="filter"
            type="radio"
            name="roadmap-filter"
            :value="option"
            class="sr-only"
          >
          {{ option === 'all' ? $t('roadmap.filterAll') : $t(`roadmap.itemStatus.${option}`) }}
        </label>
      </div>
    </fieldset>

    <div
      class="mt-8 border-t border-line"
      aria-live="polite"
    >
      <section
        v-for="group in groups"
        :key="group.key"
        :aria-labelledby="`version-${group.key}`"
        class="grid gap-x-8 gap-y-3 border-b border-line py-5 sm:grid-cols-[9rem_minmax(0,1fr)]"
      >
        <h2
          :id="`version-${group.key}`"
          :class="group.mono ? 'font-mono text-md' : 'font-display text-md font-semibold'"
        >
          {{ group.label }}
        </h2>
        <ul class="space-y-4">
          <li
            v-for="item in group.items"
            :key="item.id"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 class="font-medium">
                {{ $t(`roadmap.items.${item.id}.name`) }}
              </h3>
              <RoadmapStatus :status="item.status" />
            </div>
            <p class="mt-1 max-w-measure text-fg-muted">
              {{ $t(`roadmap.items.${item.id}.summary`) }}
            </p>
            <p class="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-fg-muted">
              <span v-if="item.released">{{ $t('roadmap.releasedOn', { date: date(item.released) }) }}</span>
              <RoadmapLink :item="item" />
            </p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
