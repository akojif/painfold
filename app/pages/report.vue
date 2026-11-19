<script setup lang="ts">
// Step 4 (#142): the report, in the workspace layout (#141). Jobs, pains and
// gains with the numbers counted in code, and the verified quotes linked to
// their rows (WorkspaceReport). It also shows the demo (#130), with no file
// open too; then the top bar shows the steps without claiming an import.
definePageMeta({
  step: 4,
  workspace: true,
  // Below 768 px the layout shows SmallScreenNotice instead, also from a direct link (#139).
  working: true,
  needsReview: true,
  // No report without a checked file, except the demo (#130); this runs in the browser only.
  middleware: () => {
    // While the app takes over a served page, the layout decides once it is mounted.
    if (import.meta.client && !useNuxtApp().isHydrating && !useSession().review.value && !useTagging().demo.value && !useSmallScreen().narrow.value) return navigateTo(useLocalePath()('/'))
  },
})

const { t } = useI18n()
useHead({ title: () => `${t('results.title')}, ${t('app.name')}` })
</script>

<template>
  <WorkspaceReport />
</template>
