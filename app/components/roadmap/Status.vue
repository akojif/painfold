<script setup lang="ts">
// The status of a roadmap item as a small badge: filled for what is released
// or being built, outlined for what is planned, dashed for an idea.
defineProps<{ status: ItemStatus }>()

const style: Record<ItemStatus, string> = {
  released: 'bg-fg text-canvas',
  inProgress: 'bg-accent text-on-accent',
  planned: 'border border-line-strong text-fg',
  idea: 'border border-dashed border-line-strong text-fg-muted',
}
</script>

<template>
  <span
    class="inline-block shrink-0 rounded-sm px-1.5 py-px text-xs font-medium whitespace-nowrap"
    :class="style[status]"
  >{{ $t(`roadmap.itemStatus.${status}`) }}</span>
</template>
