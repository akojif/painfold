<script setup lang="ts">
// Step 3 of the flow (Import, Review, Analyze, Report, #142), in the workspace (#141).
// Where the analysis runs is AnalyzeSetup; what is sent, and sending, is ConsentStep.
definePageMeta({
  step: 3,
  workspace: true,
  // Below 768 px the layout shows SmallScreenNotice instead, also from a direct link (#139).
  working: true,
  needsReview: true,
  // Nothing to analyze without a checked file; this runs in the browser only.
  middleware: () => {
    // While the app takes over a served page, the layout decides once it is mounted.
    if (import.meta.client && !useNuxtApp().isHydrating && !useSession().review.value && !useSmallScreen().narrow.value) return navigateTo(useLocalePath()('/'))
  },
})

const { t } = useI18n()
useHead({ title: () => `${t('analyze.title')}, ${t('app.name')}` })
</script>

<template>
  <WorkspaceAnalyze />
</template>
