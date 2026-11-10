<script setup lang="ts">
// What happened to a file that did not open: an error that says what to do,
// or, for documents and transcripts, a friendly note that they are on the
// roadmap. Shown where files are opened, and on every step after a drop.
defineProps<{ dismissible?: boolean }>()
const localePath = useLocalePath()
const { error, documentFormat, dismiss } = useOpenFile()
</script>

<template>
  <div
    v-if="documentFormat"
    role="status"
    class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
  >
    <p>
      {{ $t('importNotes.document') }}
      <NuxtLink
        :to="localePath('/roadmap')"
        class="group focus-ring inline-flex items-center gap-1 rounded-sm text-accent underline-offset-4 hover:underline"
      >
        {{ $t('importNotes.roadmap') }}
        <LinkArrow />
      </NuxtLink>
    </p>
    <button
      v-if="dismissible"
      type="button"
      class="press focus-ring rounded-sm text-fg-muted hover:text-fg"
      @click="dismiss"
    >
      {{ $t('importNotes.dismiss') }}
    </button>
  </div>
  <div
    v-else-if="error"
    role="alert"
    class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
  >
    <p class="flex gap-2.5">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        class="mt-0.5 size-4 shrink-0 fill-current"
      ><path d="M8 1 15 14H1Z M7.25 6v4h1.5V6Zm0 5v1.5h1.5V11Z" /></svg>
      <span>{{ $t(`importErrors.${error}`) }}</span>
    </p>
    <button
      v-if="dismissible"
      type="button"
      class="press focus-ring rounded-sm text-fg-muted hover:text-fg"
      @click="dismiss"
    >
      {{ $t('importNotes.dismiss') }}
    </button>
  </div>
</template>
