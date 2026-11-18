<script setup lang="ts">
// What Painfold does now and what comes next, from app/utils/roadmap-items.ts.
// No dates ahead: only released versions have one.
// Prototype (proto/roadmap): three variations, swapped with the switcher and
// kept in the address (?variant=b). The prerendered page is variation A; the
// address is read once the page is running.
const { t } = useI18n()
useHead({ title: () => `${t('roadmap.title')}, ${t('app.name')}` })

const route = useRoute()
const router = useRouter()
const variant = ref<RoadmapVariant>('a')
// Only once the first navigation has finished: an earlier replace is overwritten by it.
onMounted(async () => {
  await router.isReady()
  const asked = route.query.variant
  if (typeof asked === 'string' && (ROADMAP_VARIANTS as readonly string[]).includes(asked)) variant.value = asked as RoadmapVariant
  watch(variant, value => router.replace({ path: route.path, query: { ...route.query, variant: value }, hash: route.hash }))
})
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold">
      {{ $t('roadmap.title') }}
    </h1>
    <p class="mt-2 max-w-measure text-md text-fg-muted">
      {{ $t('roadmap.intro') }}
    </p>

    <RoadmapTimeline v-if="variant === 'a'" />
    <RoadmapBoard v-else-if="variant === 'b'" />
    <RoadmapVersions v-else />

    <a
      :href="ROADMAP_URL"
      class="focus-ring mt-10 inline-block rounded-sm text-sm text-accent underline-offset-4 hover:underline"
    >
      {{ $t('roadmap.full') }}
    </a>

    <RoadmapSwitcher v-model="variant" />
  </div>
</template>
