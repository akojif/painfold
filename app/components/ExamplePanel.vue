<script setup lang="ts">
// A support ticket before and after cleaning: once, shortly after the page
// loads, the phone number and email turn into their placeholders, and the
// value list below shows the same change. With reduced motion it starts cleaned.
const cleaned = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) cleaned.value = true
  else timer = setTimeout(() => (cleaned.value = true), 900)
})
onBeforeUnmount(() => clearTimeout(timer))

// Each value found, and the placeholder it becomes.
const values = [
  { type: 'EMAIL', value: 'anna.huber@example.com', token: '[EMAIL_1]' },
  { type: 'PHONE', value: '+49 30 23125 417', token: '[PHONE_1]' },
  { type: 'IBAN', value: 'AT61 1904 3002 3457 3201', token: '[IBAN_1]' },
  { type: 'ADDRESS', value: 'Lindengasse 5/2/7', token: '[ADDRESS_1]' },
  { type: 'DATE_OF_BIRTH', value: '12.03.1987', token: '[DATE_OF_BIRTH_1]' },
] as const
</script>

<template>
  <figure
    class="overflow-hidden rounded-md border border-line bg-canvas shadow-raised"
    :data-cleaned="cleaned ? '' : undefined"
  >
    <figcaption class="border-b border-line bg-surface px-4 py-2.5 text-sm text-fg-muted">
      {{ $t('example.caption') }}
    </figcaption>
    <p class="sr-only">
      {{ $t('example.description') }}
    </p>

    <div
      aria-hidden="true"
      class="border-b border-line px-5 py-5 text-md leading-7"
    >
      <i18n-t
        keypath="example.ticket"
        tag="p"
      >
        <template #phone>
          <RedactionToken
            v-if="cleaned"
            :placeholder="values[1].token"
            motion="wipe"
          />
          <span
            v-else
            class="rounded-sm bg-pending px-0.5 text-on-pending underline decoration-pending-line decoration-1 underline-offset-4"
          >{{ $t('example.phone') }}</span>
        </template>
        <template #email>
          <RedactionToken
            v-if="cleaned"
            :placeholder="values[0].token"
            motion="wipe"
          />
          <span
            v-else
            class="rounded-sm bg-pending px-0.5 text-on-pending underline decoration-pending-line decoration-1 underline-offset-4"
          >{{ $t('example.email') }}</span>
        </template>
      </i18n-t>
    </div>

    <div aria-hidden="true">
      <p class="px-5 pt-4 pb-1 text-xs text-fg-muted">
        {{ $t('example.found') }}
      </p>
      <!-- One grid for all rows (subgrid), so values, arrows and placeholders line up.
           On small screens the type is left out: the placeholder names it. -->
      <ul class="grid grid-cols-[minmax(0,1fr)_auto_auto] px-2 pb-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
        <li
          v-for="item in values"
          :key="item.type"
          class="col-span-3 grid grid-cols-subgrid items-center gap-x-2.5 rounded-sm px-3 py-1.5 text-sm sm:col-span-4"
        >
          <span class="whitespace-nowrap text-fg-muted max-sm:hidden">{{ $t(`typeOne.${item.type}`) }}</span>
          <span class="truncate font-mono text-xs text-fg-muted">{{ item.value }}</span>
          <svg
            viewBox="0 0 16 16"
            class="size-3 fill-none stroke-current stroke-[1.5] text-fg-muted"
          ><path d="M3 8h10m-3.5-3.5L13 8l-3.5 3.5" /></svg>
          <!-- The token's space is kept before it appears, so the row does not shift. -->
          <RedactionToken
            class="justify-self-start"
            :class="{ invisible: !cleaned }"
            :placeholder="item.token"
            :motion="cleaned ? 'wipe' : undefined"
          />
        </li>
      </ul>
    </div>
  </figure>
</template>
