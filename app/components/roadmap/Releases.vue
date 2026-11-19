<script setup lang="ts">
// The released versions: the newest few, newest first, and the rest in
// place on request. A compact list on a phone, a row on wider screens.
const props = defineProps<{ items: readonly RoadmapItem[] }>()
const { date, number } = useFormat()
const open = ref(false)
const all = computed(() => releasesOf(props.items))
const view = computed(() => capped(all.value, RELEASES_SHOWN, open.value))
</script>

<template>
  <section aria-labelledby="roadmap-released">
    <h2
      id="roadmap-released"
      class="text-sm font-medium text-fg-muted"
    >
      {{ $t('roadmap.horizons.released.name') }}
    </h2>
    <ul
      id="roadmap-releases"
      class="mt-2 divide-y divide-line border-y border-line sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 sm:border-0"
    >
      <li
        v-for="item in view.shown"
        :key="item.id"
        class="py-3 sm:rounded-md sm:border sm:border-line sm:p-3"
      >
        <h3 class="flex items-baseline gap-2">
          <span class="font-mono text-xs text-fg-muted">{{ item.version }}</span>
          <span class="font-medium">{{ $t(`roadmap.items.${item.id}.name`) }}</span>
        </h3>
        <p class="mt-1 line-clamp-1 text-sm text-fg-muted sm:line-clamp-none">
          {{ $t(`roadmap.items.${item.id}.summary`) }}
        </p>
        <p class="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-fg-muted">
          <span>{{ date(item.released!) }}</span>
          <RoadmapLink :item="item" />
        </p>
      </li>
    </ul>
    <button
      v-if="all.length > RELEASES_SHOWN"
      type="button"
      class="press focus-ring mt-3 rounded-sm text-sm text-accent underline-offset-4 hover:underline"
      :aria-expanded="open"
      aria-controls="roadmap-releases"
      @click="open = !open"
    >
      {{ open ? $t('roadmap.fewerReleases') : $t('roadmap.allReleases', { n: number(all.length) }) }}
    </button>
  </section>
</template>
