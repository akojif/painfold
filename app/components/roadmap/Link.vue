<script setup lang="ts">
// Where a roadmap item is tracked on GitHub, opened in a new tab (said in
// visually hidden text, without an arrow).
const props = defineProps<{ item: RoadmapItem }>()
const key = computed(() => ({ release: 'linkRelease', issue: 'linkIssue', milestone: 'linkMilestone' })[props.item.link.kind])
</script>

<template>
  <a
    :href="item.link.url"
    target="_blank"
    rel="noopener"
    class="focus-ring rounded-sm text-sm text-accent underline-offset-4 hover:underline"
  >{{ $t(`roadmap.${key}`, { label: item.link.label }) }}<span class="sr-only"> {{ $t('roadmap.newTab') }}</span></a>
</template>
