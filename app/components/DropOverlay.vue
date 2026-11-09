<script setup lang="ts">
defineProps<{ visible: boolean }>()
</script>

<template>
  <div
    v-if="visible"
    class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-canvas/90 p-6"
    aria-hidden="true"
  >
    <div class="animate-overlay-in flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-accent bg-canvas px-10 py-12 text-center shadow-overlay">
      <svg
        viewBox="0 0 24 24"
        class="size-7 fill-none stroke-accent stroke-[1.6]"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="M12 15V3m0 12-4-4m4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
      <p class="text-lg font-medium">
        {{ $t('start.dropOverlay') }}
      </p>
    </div>
  </div>
</template>
