<script setup lang="ts">
// One item in a column: name, version and link always; the description in
// full, or its first line with the rest on request. "More" appears only when
// the first line actually cuts the text off, checked again when the card's
// width changes.
const props = defineProps<{ item: RoadmapItem, full: boolean }>()
const open = ref(false)
const id = `card-${props.item.id}-text`
const text = useTemplateRef<HTMLElement>('text')
const cut = ref(false)
let observer: ResizeObserver | undefined
const measure = () => {
  if (text.value && !open.value) cut.value = text.value.scrollHeight > text.value.clientHeight + 1
}
onMounted(() => {
  if (props.full || !text.value) return
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(text.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
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
    <p
      :id="id"
      ref="text"
      class="mt-1 text-sm text-fg-muted"
      :class="full || open ? '' : 'line-clamp-1'"
    >
      {{ $t(`roadmap.items.${item.id}.summary`) }}
    </p>
    <div class="mt-2 flex items-baseline justify-between gap-3">
      <RoadmapLink :item="item" />
      <button
        v-if="!full && (cut || open)"
        type="button"
        class="press focus-ring rounded-sm text-xs text-fg-muted hover:text-fg"
        :aria-expanded="open"
        :aria-controls="id"
        @click="open = !open"
      >
        {{ open ? $t('roadmap.less') : $t('roadmap.more') }}<span class="sr-only">: {{ $t(`roadmap.items.${item.id}.name`) }}</span>
      </button>
    </div>
  </div>
</template>
