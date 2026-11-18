<script setup lang="ts">
// Variation A: one rail from the first release to the ideas. A marker after
// the latest release says where Painfold is now; everything below it is ahead.
const { date } = useFormat()
const groups = HORIZONS.map(horizon => ({ horizon, items: ROADMAP_ITEMS.filter(item => item.horizon === horizon) })).filter(group => group.items.length > 0)
</script>

<template>
  <ol class="mt-10 max-w-2xl">
    <template
      v-for="group in groups"
      :key="group.horizon"
    >
      <li
        v-if="group.horizon === 'now'"
        class="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-8"
      >
        <div
          aria-hidden="true"
          class="relative flex justify-center"
        >
          <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
          <span class="relative mt-1 size-3 rounded-full bg-accent ring-4 ring-canvas" />
        </div>
        <p class="text-sm font-medium text-accent">
          {{ $t('roadmap.youAreHere') }}
        </p>
      </li>
      <li class="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-3">
        <div
          aria-hidden="true"
          class="relative flex justify-center"
        >
          <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
        </div>
        <div :id="`timeline-${group.horizon}`">
          <h2 class="font-display text-md font-semibold">
            {{ $t(`roadmap.horizons.${group.horizon}.name`) }}
          </h2>
          <p class="text-sm text-fg-muted">
            {{ $t(`roadmap.horizons.${group.horizon}.hint`) }}
          </p>
        </div>
      </li>
      <li
        v-for="(item, index) in group.items"
        :key="item.id"
        class="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-7"
      >
        <div
          aria-hidden="true"
          class="relative flex justify-center"
        >
          <span
            class="absolute left-1/2 w-px -translate-x-1/2 bg-line"
            :class="group.horizon === 'idea' && index === group.items.length - 1 ? 'top-0 h-2.5' : 'inset-y-0'"
          />
          <span
            class="relative mt-1.5 size-2.5 rounded-full ring-4 ring-canvas"
            :class="{
              'bg-fg': item.status === 'released',
              'bg-accent': item.status === 'inProgress',
              'border border-line-strong bg-canvas': item.status === 'planned',
              'border border-dashed border-line-strong bg-canvas': item.status === 'idea',
            }"
          />
        </div>
        <section :aria-labelledby="`timeline-item-${item.id}`">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3
              :id="`timeline-item-${item.id}`"
              class="flex items-baseline gap-2 font-medium"
            >
              <span
                v-if="item.version"
                class="font-mono text-xs text-fg-muted"
              >{{ item.version }}</span>{{ ' ' }}<span class="text-fg">{{ $t(`roadmap.items.${item.id}.name`) }}</span>
            </h3>
            <RoadmapStatus
              v-if="item.status !== 'released'"
              :status="item.status"
            />
          </div>
          <p class="mt-1 max-w-measure text-fg-muted">
            {{ $t(`roadmap.items.${item.id}.summary`) }}
          </p>
          <p class="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-fg-muted">
            <span v-if="item.released">{{ $t('roadmap.releasedOn', { date: date(item.released) }) }}</span>
            <RoadmapLink :item="item" />
          </p>
        </section>
      </li>
    </template>
  </ol>
</template>
