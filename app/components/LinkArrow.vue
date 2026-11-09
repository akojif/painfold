<script setup lang="ts">
// The arrow after a text link that goes to another page: right for a page in
// Painfold, up-right for another site. Buttons never get one. On hover the
// arrow nudges 2px in its direction; the link needs the `group` class.
defineProps<{ external?: boolean }>()
</script>

<template>
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    class="size-3.5 shrink-0 fill-none stroke-current stroke-[1.6] transition-transform duration-150 ease-out motion-reduce:transition-none"
    :class="external ? 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5' : 'group-hover:translate-x-0.5'"
  >
    <path
      v-if="external"
      d="M5 11 11 5M6 5h5v5"
    />
    <path
      v-else
      d="M3 8h10M9 4l4 4-4 4"
    />
  </svg>
</template>
