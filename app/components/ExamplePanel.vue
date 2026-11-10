<script setup lang="ts">
// A support ticket before and after cleaning: once, shortly after the page
// loads, the name, place, phone number and email turn into their placeholders,
// and the value list below shows the same change. With reduced motion it starts cleaned.
const cleaned = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) cleaned.value = true
  else timer = setTimeout(() => (cleaned.value = true), 900)
})
onBeforeUnmount(() => clearTimeout(timer))

// Each value found and the placeholder it becomes. The values come from the
// locale files, so the English page shows an English ticket and /de/ a German
// one; all of them are reserved or documentation values (see data/README.md).
const values = [
  { type: 'NAME', key: 'name', token: '[NAME_1]' },
  { type: 'PLACE', key: 'place', token: '[PLACE_1]' },
  { type: 'EMAIL', key: 'email', token: '[EMAIL_1]' },
  { type: 'PHONE', key: 'phone', token: '[PHONE_1]' },
  { type: 'IBAN', key: 'iban', token: '[IBAN_1]' },
  { type: 'ADDRESS', key: 'address', token: '[ADDRESS_1]' },
  { type: 'DATE_OF_BIRTH', key: 'dateOfBirth', token: '[DATE_OF_BIRTH_1]' },
] as const
// The values that appear in the ticket itself, each a placeholder that reveals what it replaced.
const inTicket = values.filter(item => (['name', 'place', 'phone', 'email'] as string[]).includes(item.key))
</script>

<template>
  <div>
    <!-- No overflow-hidden here: the placeholders' tooltips may reach past the panel. -->
    <figure
      class="rounded-md border border-line bg-canvas shadow-raised"
      :data-cleaned="cleaned ? '' : undefined"
    >
      <figcaption class="rounded-t-md border-b border-line bg-surface px-4 py-2.5 text-sm text-fg-muted">
        {{ $t('example.caption') }}
      </figcaption>
      <p class="sr-only">
        {{ $t('example.description') }}
      </p>

      <!-- The ticket is read by screen readers: each placeholder is a button that announces what it replaced. -->
      <div class="border-b border-line px-5 py-5 text-md leading-7">
        <i18n-t
          keypath="example.ticket"
          tag="p"
        >
          <template
            v-for="item in inTicket"
            :key="item.key"
            #[item.key]
          >
            <RevealToken
              v-if="cleaned"
              :placeholder="item.token"
              :type="item.type"
              :original="$t(`example.values.${item.key}`)"
            />
            <span
              v-else
              class="rounded-sm bg-pending px-0.5 text-on-pending underline decoration-pending-line decoration-1 underline-offset-4"
            >{{ $t(`example.values.${item.key}`) }}</span>
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
            <span class="truncate font-mono text-xs text-fg-muted">{{ $t(`example.values.${item.key}`) }}</span>
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
    <p class="mt-3 text-xs text-fg-muted">
      {{ $t('example.languages') }}
    </p>
  </div>
</template>
