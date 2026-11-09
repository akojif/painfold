<script setup lang="ts">
const props = defineProps<{ done: number, total: number }>()
const { number } = useFormat()
const percent = computed(() => (props.total === 0 ? 0 : Math.round((props.done / props.total) * 100)))
</script>

<template>
  <div class="space-y-2">
    <p aria-live="polite">
      {{ $t('find.progress', { done: number(done), total: number(total) }) }}
    </p>
    <div
      role="progressbar"
      :aria-label="$t('find.progressLabel')"
      aria-valuemin="0"
      :aria-valuemax="total"
      :aria-valuenow="done"
      class="h-1.5 w-full max-w-md bg-rule"
    >
      <div
        class="h-full bg-signal"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
