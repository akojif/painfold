<script setup lang="ts">
import type { NuxtError } from '#app'

// The page for a missing address (prerendered as 404.html) and any other
// error. On a 404, the address you typed is treated like personal data in the
// review: shown as waiting, then replaced by its placeholder, once.
const props = defineProps<{ error: NuxtError }>()
const PLACEHOLDER = '[PAGE_404]'
const { t } = useI18n()
const kind = computed(() => (props.error.statusCode === 404 ? 'notFound' : 'other'))
useHead({ title: () => `${t(`error.${kind.value}.title`)}, ${t('app.name')}` })

// The path is only known in the browser: 404.html is the same file for every missing address.
const path = ref<string>()
const cleaned = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  try {
    path.value = decodeURI(window.location.pathname)
  }
  catch {
    // A malformed address such as /%E0%A4 cannot be decoded; show it as typed.
    path.value = window.location.pathname
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) cleaned.value = true
  else timer = setTimeout(() => (cleaned.value = true), 700)
})
onBeforeUnmount(() => clearTimeout(timer))

// Leaving the error page has to clear the error, or it stays on screen.
const leave = (to: string) => clearError({ redirect: to })
</script>

<template>
  <NuxtLayout>
    <section class="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <p
        v-if="kind === 'notFound'"
        class="flex h-8 max-w-full items-center font-mono text-md"
      >
        <span
          v-if="path"
          class="sr-only"
        >{{ $t('error.path', { path }) }}</span>
        <template v-if="path">
          <RedactionToken
            v-if="cleaned"
            aria-hidden="true"
            :placeholder="PLACEHOLDER"
            motion="wipe"
          />
          <span
            v-else
            aria-hidden="true"
            class="max-w-full truncate rounded-sm bg-pending px-1 text-on-pending underline decoration-pending-line decoration-1 underline-offset-4"
          >{{ path }}</span>
        </template>
      </p>

      <h1 class="mt-6 text-2xl font-semibold">
        {{ $t(`error.${kind}.heading`) }}
      </h1>
      <p class="mt-3 max-w-[44ch] text-md text-fg-muted">
        {{ $t(`error.${kind}.body`) }}
      </p>

      <div class="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
        <a
          href="/"
          class="press focus-ring inline-flex h-10 items-center rounded-md bg-fg px-4 font-medium text-canvas hover:opacity-90"
          @click.prevent="leave('/')"
        >
          {{ $t('error.home') }}
        </a>
        <a
          v-if="kind === 'notFound'"
          href="/roadmap"
          class="focus-ring rounded-sm text-sm text-accent underline-offset-4 hover:underline"
          @click.prevent="leave('/roadmap')"
        >
          {{ $t('error.roadmap') }}
        </a>
      </div>
    </section>
  </NuxtLayout>
</template>
