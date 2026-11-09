<script setup lang="ts">
const route = useRoute()
const step = computed(() => (route.meta.step as number | undefined) ?? 1)
// Catch file drops everywhere, so a browser never opens a dropped file and leaves the app.
useFileDrop()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-rule">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
        <NuxtLink
          to="/"
          class="flex items-center gap-2.5 outline-signal focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            class="size-5 fill-none stroke-ink stroke-[1.5]"
          ><path d="M4.5 2.5h7l4 4v11h-11Z M11.5 2.5v4h4" /><path
            d="M7 10.5h6"
            class="stroke-2"
          /><path d="M7 13.5h4" /></svg>
          <span class="font-serif text-xl font-semibold">{{ $t('app.name') }}</span>
        </NuxtLink>
        <OutboundIndicator />
      </div>
    </header>

    <div class="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 md:px-8">
      <AppStepper :current="step" />
      <main class="mt-10 md:mt-16">
        <slot />
      </main>
    </div>

    <footer class="border-t border-rule">
      <div class="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-ink-muted md:px-8">
        <p>
          <!-- The start screen says this in its lead; every other step says it here. -->
          <template v-if="step > 1">
            {{ $t('privacy.notice') }}
          </template>
          {{ $t('footer.promise') }}
        </p>
        <a
          href="https://github.com/akojif/painfold"
          class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
        >{{ $t('footer.source') }}</a>
      </div>
    </footer>
  </div>
</template>
