<script setup lang="ts">
// Variation B: what is released in one compact row, then four columns for
// what comes after it: now, next, later and ideas. On a phone the columns
// stack, with "now" first.
const { date, number } = useFormat()
const released = [...ROADMAP_ITEMS.filter(item => item.horizon === 'released')].reverse()
const columns = (['now', 'next', 'later', 'idea'] as const).map(horizon => ({ horizon, items: ROADMAP_ITEMS.filter(item => item.horizon === horizon) }))
</script>

<template>
  <div class="mt-10">
    <section aria-labelledby="board-released">
      <h2
        id="board-released"
        class="text-sm font-medium text-fg-muted"
      >
        {{ $t('roadmap.horizons.released.name') }}
      </h2>
      <ul class="mt-2 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
        <li
          v-for="item in released"
          :key="item.id"
          class="bg-canvas p-3"
        >
          <p class="flex items-baseline gap-2">
            <span class="font-mono text-xs text-fg-muted">{{ item.version }}</span>
            <span class="font-medium">{{ $t(`roadmap.items.${item.id}.name`) }}</span>
          </p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-3 text-sm text-fg-muted">
            <span>{{ date(item.released!) }}</span>
            <RoadmapLink :item="item" />
          </p>
        </li>
      </ul>
    </section>

    <div class="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
      <section
        v-for="column in columns"
        :key="column.horizon"
        :aria-labelledby="`board-${column.horizon}`"
      >
        <div
          class="border-t-2 pt-3"
          :class="column.horizon === 'now' ? 'border-accent' : column.horizon === 'idea' ? 'border-dashed border-line-strong' : 'border-line-strong'"
        >
          <h2
            :id="`board-${column.horizon}`"
            class="flex items-baseline justify-between gap-2 font-display text-md font-semibold"
          >
            {{ $t(`roadmap.horizons.${column.horizon}.name`) }}
            <span class="font-mono text-xs font-normal text-fg-muted tabular-nums">{{ number(column.items.length) }}</span>
          </h2>
          <p class="text-sm text-fg-muted">
            {{ $t(`roadmap.horizons.${column.horizon}.hint`) }}
          </p>
        </div>
        <ul class="mt-4 space-y-3">
          <li
            v-for="item in column.items"
            :key="item.id"
            class="rounded-md border p-3"
            :class="item.status === 'inProgress' ? 'border-accent' : item.status === 'idea' ? 'border-dashed border-line-strong' : 'border-line'"
          >
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-medium">
                {{ $t(`roadmap.items.${item.id}.name`) }}
              </h3>
              <span
                v-if="item.version"
                class="mt-0.5 shrink-0 font-mono text-xs text-fg-muted"
              >{{ item.version }}</span>
            </div>
            <p class="mt-1 text-sm text-fg-muted">
              {{ $t(`roadmap.items.${item.id}.summary`) }}
            </p>
            <p class="mt-2">
              <RoadmapLink :item="item" />
            </p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
