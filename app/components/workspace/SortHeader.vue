<script setup lang="ts">
// A sortable column header. The button sorts; aria-sort on the th says how.
const props = defineProps<{ label: string, column: string, sort: { column: string, direction: 'ascending' | 'descending' }, numeric?: boolean }>()
const emit = defineEmits<{ sort: [column: string] }>()
const active = computed(() => props.sort.column === props.column)
</script>

<template>
  <th
    scope="col"
    :aria-sort="active ? sort.direction : undefined"
    class="sticky top-14 z-10 border-b border-line bg-canvas px-3 py-0 text-xs font-medium whitespace-nowrap text-fg-muted"
    :class="numeric ? 'text-right' : 'text-left'"
  >
    <button
      type="button"
      class="focus-ring press inline-flex h-9 items-center gap-1 rounded-sm hover:text-fg"
      :class="[numeric ? 'flex-row-reverse' : '', active ? 'text-fg' : '']"
      @click="emit('sort', column)"
    >
      {{ label }}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        class="size-3 fill-none stroke-current stroke-[1.4]"
        :class="active ? '' : 'opacity-0'"
      ><path :d="active && sort.direction === 'ascending' ? 'M3 7.5 6 4.5l3 3' : 'M3 4.5 6 7.5l3-3'" /></svg>
    </button>
  </th>
</template>
