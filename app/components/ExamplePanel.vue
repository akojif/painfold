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

const values = [
  { type: 'EMAIL', value: 'anna.huber@example.com', rows: 3, token: '[EMAIL_1]' },
  { type: 'PHONE', value: '+49 30 23125 417', rows: 1, token: '[PHONE_1]' },
  { type: 'IBAN', value: 'AT61 1904 3002 3457 3201', rows: 2 },
  { type: 'ADDRESS', value: 'Lindengasse 5/2/7', rows: 1 },
  { type: 'DATE_OF_BIRTH', value: '12.03.1987', rows: 1 },
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
      <ul class="px-2 pb-3">
        <li
          v-for="item in values"
          :key="item.type"
          class="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-3 py-1.5 text-sm"
        >
          <span class="truncate text-fg-muted">{{ $t(`typeOne.${item.type}`) }}</span>
          <RedactionToken
            v-if="cleaned && 'token' in item"
            class="justify-self-start"
            :placeholder="item.token"
            motion="wipe"
          />
          <span
            v-else
            class="truncate font-mono text-xs"
          >{{ item.value }}</span>
          <span class="text-xs text-fg-muted tabular-nums">{{ $t('example.rows', { n: item.rows }, item.rows) }}</span>
        </li>
      </ul>
    </div>
  </figure>
</template>
