<script setup lang="ts">
// The privacy notice (CLAUDE.md, ROADMAP.md), with its lock: on the start
// page, and on Review and Analyze, where people decide what leaves the
// browser (#147). The footer carries only its short form (privacy.short).
</script>

<template>
  <div class="flex gap-2 text-sm text-fg-muted">
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="mt-0.5 size-4 shrink-0 fill-none stroke-current stroke-[1.6]"
      stroke-linecap="round"
      stroke-linejoin="round"
    ><rect
      x="5"
      y="11"
      width="14"
      height="9"
      rx="2"
    /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    <p>
      {{ $t('privacy.notice') }}
      <span class="block">{{ $t('privacy.noticeAi') }}</span>
    </p>
  </div>
</template>
