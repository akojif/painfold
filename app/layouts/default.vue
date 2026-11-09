<script setup lang="ts">
const route = useRoute()
const { table } = useSession()
const step = computed(() => (route.meta.step as number | undefined) ?? 1)
// The empty start screen explains the product instead; steps appear once a file is open.
const showSteps = computed(() => step.value > 1 || Boolean(table.value))
// Catch file drops everywhere, so a browser never opens a dropped file and leaves the app.
useFileDrop()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-20 border-b border-line bg-canvas">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <NuxtLink
          to="/"
          class="focus-ring flex items-center gap-2.5 rounded-sm text-md font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            class="relative size-[18px] rounded-[5px] bg-fg after:absolute after:inset-x-1 after:top-[7.5px] after:h-[3px] after:rounded-[1px] after:bg-canvas"
          />
          {{ $t('app.name') }}
        </NuxtLink>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <OutboundIndicator />
        </div>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <AppStepper
        v-if="showSteps"
        class="pt-6"
        :current="step"
      />
      <main class="flex flex-1 flex-col py-8 sm:py-10">
        <slot />
      </main>
    </div>

    <footer class="border-t border-line">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-fg-muted sm:px-6">
        <p>
          <!-- The start screen states this once in its own content; every other step states it here. -->
          <template v-if="step > 1 || table">
            {{ $t('privacy.notice') }}
          </template>
        </p>
        <nav class="flex gap-5">
          <a
            href="https://github.com/akojif/painfold/blob/main/ROADMAP.md"
            class="focus-ring rounded-sm hover:text-fg"
          >{{ $t('footer.roadmap') }}</a>
          <a
            href="https://github.com/akojif/painfold"
            class="focus-ring rounded-sm hover:text-fg"
          >{{ $t('footer.source') }}</a>
        </nav>
      </div>
    </footer>
  </div>
</template>
