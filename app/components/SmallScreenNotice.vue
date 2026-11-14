<script setup lang="ts">
// What a working route shows below 768 px (#139), in place of the page. From a
// direct link, with no file open: the same message as the start page's sheet,
// with Copy link and the way to the start page. With a file open (the window
// was narrowed mid-flow): a calm note that the file is still there; widening
// the window brings the page back as it was.
defineProps<{ fileOpen: boolean }>()
const { t } = useI18n()
const localePath = useLocalePath()
const { link, copied, copy } = useCopyLink()
</script>

<template>
  <section
    class="max-w-md"
    aria-labelledby="small-screen-notice"
  >
    <h1
      id="small-screen-notice"
      class="text-xl font-semibold"
    >
      {{ fileOpen ? $t('smallScreen.pausedTitle') : $t('smallScreen.title') }}
    </h1>
    <p class="mt-2 text-fg-muted">
      {{ fileOpen ? $t('smallScreen.paused') : $t('smallScreen.body') }}
    </p>
    <template v-if="!fileOpen">
      <p
        v-if="copied === 'manual'"
        class="mt-3 rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-sm break-all select-all"
      >
        {{ link }}
      </p>
      <div class="mt-5 grid gap-2">
        <button
          type="button"
          class="press focus-ring h-11 rounded-md bg-fg px-4 font-medium text-canvas hover:opacity-90"
          @click="copy"
        >
          {{ copied === 'yes' ? $t('smallScreen.copied') : $t('smallScreen.copy') }}
        </button>
        <NuxtLink
          :to="localePath('/')"
          class="press focus-ring inline-flex h-11 items-center justify-center rounded-md border border-line px-4 hover:border-line-strong"
        >
          {{ $t('smallScreen.start') }}
        </NuxtLink>
      </div>
      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ copied === 'yes' ? t('smallScreen.copied') : copied === 'manual' ? t('smallScreen.copyManually') : '' }}
      </p>
    </template>
  </section>
</template>
