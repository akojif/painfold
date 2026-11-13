<script setup lang="ts">
import type { NetworkEntry } from '~/composables/useNetworkLog'

const { t } = useI18n()
const { number } = useFormat()
const { entries, ai, foreign, sentBytes } = useNetworkLog()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const label = computed(() => t('header.bytes', { n: number(sentBytes.value) }, sentBytes.value))

function size(entry: NetworkEntry) {
  if (entry.stored) return t('network.stored')
  const { bytes } = entry
  if (bytes < 1024) return t('network.bytes', { n: number(bytes) })
  if (bytes < 1_000_000) return t('network.kilobytes', { n: number(Math.round(bytes / 1024)) })
  return t('network.megabytes', { n: number(Math.round(bytes / 1_000_000)) })
}
</script>

<template>
  <div>
    <button
      type="button"
      class="press focus-ring flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-sm text-fg-muted hover:border-line-strong hover:text-fg"
      aria-haspopup="dialog"
      @click="dialog?.showModal()"
    >
      <span
        aria-hidden="true"
        class="size-1.5 rounded-full"
        :class="foreign.length > 0 ? 'bg-danger' : 'bg-accent'"
      />
      <span class="max-sm:sr-only">{{ $t('header.outbound') }}</span>
      <span
        class="font-mono text-xs whitespace-nowrap"
        :class="foreign.length > 0 ? 'text-danger' : 'text-fg'"
      >{{ label }}</span>
    </button>

    <dialog
      ref="dialog"
      aria-labelledby="network-title"
      class="m-0 mt-16 ml-auto max-h-[80vh] w-full max-w-xl rounded-md border border-line bg-canvas p-0 text-fg shadow-overlay backdrop:bg-fg/20 open:animate-overlay-in max-sm:mt-0 max-sm:max-h-full sm:mr-6"
      @click.self="dialog?.close()"
    >
      <div class="space-y-4 px-6 py-5">
        <div class="flex items-start justify-between gap-4">
          <h2
            id="network-title"
            class="text-lg font-semibold"
          >
            {{ $t('header.outbound') }}
          </h2>
          <button
            type="button"
            class="press focus-ring rounded-sm text-sm text-fg-muted hover:text-fg"
            @click="dialog?.close()"
          >
            {{ $t('network.close') }}
          </button>
        </div>
        <p
          class="font-semibold"
          :class="foreign.length > 0 ? 'text-danger' : ai.length > 0 ? 'text-fg' : 'text-accent'"
        >
          {{ foreign.length > 0 ? $t('network.foreign', { n: foreign.length }, foreign.length) : ai.length > 0 ? $t('network.toAi', { n: ai.length }, ai.length) : $t('network.none') }}
        </p>
        <p class="text-sm text-fg-muted">
          {{ $t('network.explain') }}
        </p>
        <div class="max-h-[45vh] overflow-y-auto border-y border-line">
          <table class="w-full text-left text-sm">
            <thead class="sticky top-0 bg-canvas">
              <tr class="border-b border-line">
                <th
                  scope="col"
                  class="py-2 pr-3 font-semibold"
                >
                  {{ $t('network.destination') }}
                </th>
                <th
                  scope="col"
                  class="py-2 pr-3 font-semibold"
                >
                  {{ $t('network.what') }}
                </th>
                <th
                  scope="col"
                  class="py-2 text-right font-semibold"
                >
                  {{ $t('network.size') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, index) in entries"
                :key="index"
                class="border-b border-line last:border-b-0"
              >
                <td class="max-w-0 py-1.5 pr-3">
                  <span
                    class="block truncate font-mono text-xs"
                    :class="{ 'text-danger': !entry.own && entry.kind !== 'ai' }"
                  >{{ entry.own ? entry.url : entry.host }}</span>
                </td>
                <td class="py-1.5 pr-3 whitespace-nowrap text-fg-muted">
                  {{ entry.own || entry.kind === 'ai' ? $t(`network.kind.${entry.kind}`) : $t('network.otherSite') }}
                </td>
                <td
                  class="py-1.5 text-right whitespace-nowrap tabular-nums"
                  :class="{ 'text-fg-muted': entry.stored }"
                >
                  {{ size(entry) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p
          v-if="foreign.length === 0 && ai.length === 0"
          class="text-sm text-fg-muted"
        >
          {{ $t('network.allOwn', { host: entries[0]?.host ?? '' }) }}
        </p>
        <p
          v-else-if="foreign.length === 0"
          class="text-sm text-fg-muted"
        >
          {{ $t('network.aiOnly') }}
        </p>
      </div>
    </dialog>
  </div>
</template>
