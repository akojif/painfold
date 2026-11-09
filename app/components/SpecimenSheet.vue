<script setup lang="ts">
// The example ticket on the start screen, on a small stack of paper. It shows
// what Painfold does before any file is chosen, and lifts while a file is
// dragged over the page.
defineProps<{ lifted: boolean }>()
</script>

<template>
  <figure class="paper relative mx-auto w-full max-w-xl">
    <div
      aria-hidden="true"
      class="absolute inset-0 -translate-x-1 -translate-y-2 -rotate-1 border border-rule bg-sheet sm:-translate-x-3 sm:-translate-y-3 sm:-rotate-2"
    />
    <div
      aria-hidden="true"
      class="absolute inset-0 translate-x-1 translate-y-1 rotate-1 border border-rule bg-sheet sm:translate-x-3"
    />
    <div
      class="relative border border-rule bg-sheet px-6 pt-6 pb-16 sm:px-9 sm:pt-8 sm:pb-10 text-ink transition-[translate,box-shadow] duration-200 ease-out motion-reduce:transition-none"
      :class="lifted ? '-translate-y-2 shadow-lift' : 'shadow-sheet'"
    >
      <figcaption class="sr-only">
        {{ $t('specimen.description') }}
      </figcaption>
      <div aria-hidden="true">
        <div class="flex items-baseline justify-between gap-4 border-b border-rule pb-3 text-sm text-ink-muted">
          <span>{{ $t('specimen.ticket') }}</span>
          <span>{{ $t('specimen.date') }}</span>
        </div>
        <div class="mt-6 space-y-5 font-serif text-specimen">
          <p>
            {{ $t('specimen.before') }}
            <SpecimenValue
              :value="$t('specimen.phone')"
              placeholder="[PHONE_1]"
              :highlight-at="700"
              :sweep-at="2000"
            />
            {{ $t('specimen.middle') }}
            <SpecimenValue
              :value="$t('specimen.email')"
              placeholder="[EMAIL_1]"
              :highlight-at="1000"
              :sweep-at="2400"
            />{{ $t('specimen.after') }}
          </p>
          <p>{{ $t('specimen.closing') }}</p>
        </div>
      </div>
      <p class="absolute right-8 bottom-6 -rotate-6 border-[3px] border-double border-signal px-3 py-1 font-bold text-signal">
        {{ $t('start.stamp') }}
      </p>
    </div>
  </figure>
</template>
