<script setup lang="ts">
// One column of what comes after the releases: its heading and count, the
// most important cards first, and the rest in place on request. No inner
// scrolling. "Now" carries the accent: it is the current work.
const props = defineProps<{ column: Column, items: readonly RoadmapItem[] }>()
const { number } = useFormat()
const open = ref(false)
const view = computed(() => capped(props.items, COLUMN_CAP, open.value))
/** Now and Next show whole descriptions; Later and Ideas a first line. */
const full = props.column === 'now' || props.column === 'next'
const border: Record<Column, string> = { now: 'border-accent', next: 'border-line-strong', later: 'border-line-strong', idea: 'border-dashed border-line-strong' }
</script>

<template>
  <section :aria-labelledby="`column-${column}`">
    <div
      class="border-t-2 pt-3"
      :class="border[column]"
    >
      <h2
        :id="`column-${column}`"
        class="flex items-baseline justify-between gap-2 font-display text-md font-semibold"
      >
        {{ $t(`roadmap.horizons.${column}.name`) }}
        <span class="font-mono text-xs font-normal text-fg-muted tabular-nums">{{ number(items.length) }}</span>
      </h2>
      <p class="text-sm text-fg-muted">
        {{ $t(`roadmap.horizons.${column}.hint`) }}
      </p>
    </div>
    <p
      v-if="items.length === 0"
      class="mt-4 text-sm text-fg-muted"
    >
      {{ $t('roadmap.empty') }}
    </p>
    <ul
      v-else
      :id="`column-${column}-items`"
      class="mt-4 space-y-3"
    >
      <li
        v-for="item in view.shown"
        :key="item.id"
      >
        <RoadmapCard
          :item="item"
          :full="full"
        />
      </li>
    </ul>
    <button
      v-if="items.length > COLUMN_CAP"
      type="button"
      class="press focus-ring mt-3 rounded-sm text-sm text-accent underline-offset-4 hover:underline"
      :aria-expanded="open"
      :aria-controls="`column-${column}-items`"
      @click="open = !open"
    >
      {{ open ? $t('roadmap.showFewer') : $t('roadmap.showMore', { n: number(view.more) }) }}
    </button>
  </section>
</template>
