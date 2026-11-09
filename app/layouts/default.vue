<script setup lang="ts">
const route = useRoute()
const step = computed(() => (route.meta.step as number | undefined) ?? 1)
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-rule px-4 py-3 md:px-8">
      <NuxtLink
        to="/"
        class="text-lg font-semibold outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {{ $t('app.name') }}
      </NuxtLink>
    </header>

    <div class="flex flex-1 flex-col md:flex-row">
      <StepRail :current="step" />
      <main class="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-12">
        <slot />
      </main>
    </div>

    <footer class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-rule px-4 py-4 text-sm text-ink-muted md:px-8">
      <p>{{ $t('privacy.notice') }}</p>
      <a
        href="https://github.com/akojif/painfold"
        class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
      >{{ $t('footer.source') }}</a>
    </footer>
  </div>
</template>
