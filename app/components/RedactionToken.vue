<script setup lang="ts">
// A placeholder such as [EMAIL_1]. The animation runs once, when the token
// appears; tokens rendered later (scrolling, switching views) appear still.
defineProps<{ placeholder: string, motion?: RemovalMotion }>()
</script>

<template>
  <span
    class="inline-block rounded-sm bg-token px-1 font-mono text-[0.85em] leading-snug text-on-token"
    :class="{ 'animate-token-wipe': motion === 'wipe', 'animate-token-fade': motion === 'fade' }"
  >{{ placeholder }}</span>
</template>
