<script setup lang="ts">
// The workspace below the top bar: a sidebar with the page's context and
// filters, and the page itself. From 1,024 px the sidebar runs the full height
// on the left and its content stays in view; below that it comes first, above
// the page, so nothing scrolls sideways at 768 px (#141).
defineProps<{ sidebarLabel: string }>()
</script>

<template>
  <div class="flex flex-1 flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside
      :aria-label="sidebarLabel"
      class="border-b border-line bg-surface lg:border-r lg:border-b-0"
    >
      <div class="grid content-start gap-6 px-4 py-5 sm:px-6 md:grid-cols-2 lg:sticky lg:top-14 lg:flex lg:max-h-[calc(100dvh-3.5rem)] lg:flex-col lg:overflow-y-auto lg:px-4">
        <slot name="sidebar" />
      </div>
    </aside>
    <div class="flex min-w-0 flex-col">
      <slot />
    </div>
  </div>
</template>
