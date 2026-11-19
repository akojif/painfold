<script setup lang="ts">
// Step 2 of the flow: review every finding (#141 workspace). The state and the
// keyboard live in useReviewWorkspace, which WorkspaceReview sets up and lays out.
definePageMeta({
  step: 2,
  // Below 768 px the layout shows SmallScreenNotice instead, also from a direct link (#139).
  working: true,
  needsReview: true,
  workspace: true,
  // Nothing to review without a checked file; this runs in the browser only.
  middleware: () => {
    // While the app takes over a served page, the layout decides once it is mounted.
    if (import.meta.client && !useNuxtApp().isHydrating && !useSession().review.value && !useSmallScreen().narrow.value) return navigateTo(useLocalePath()('/'))
  },
})

const { review, table } = useSession()
</script>

<template>
  <WorkspaceReview v-if="review && table" />
</template>
