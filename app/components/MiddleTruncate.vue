<script setup lang="ts">
// Cuts a long string in the middle, keeping its end visible: file names and
// links that share a long start differ at the end. The full text is the title.
const props = withDefaults(defineProps<{ text: string, tail?: number }>(), { tail: 14 })
const head = computed(() => props.text.slice(0, Math.max(0, props.text.length - props.tail)))
const end = computed(() => props.text.slice(-props.tail))
</script>

<template>
  <span
    class="inline-flex max-w-full min-w-0"
    :title="text"
  >
    <span class="truncate">{{ head }}</span>
    <span class="shrink-0 whitespace-pre">{{ end }}</span>
  </span>
</template>
