<script setup lang="ts">
definePageMeta({
  step: 3,
  middleware: () => {
    if (import.meta.client && !useSession().review.value) return navigateTo('/')
  },
})
</script>

<template>
  <ClientOnly>
    <h1 class="font-serif text-3xl font-semibold">
      {{ $t('download.heading') }}
    </h1>
  </ClientOnly>
</template>
