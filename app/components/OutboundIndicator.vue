<script setup lang="ts">
const { t } = useI18n()
const { number } = useFormat()
const { entries, foreign, foreignBytes } = useNetworkLog()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const label = computed(() => t('header.bytes', { n: number(foreignBytes.value) }, foreignBytes.value))

function size(bytes: number) {
  return bytes < 1024 ? t('network.bytes', { n: number(bytes) }) : t('network.kilobytes', { n: number(Math.round(bytes / 1024)) })
}
</script>

<template>
  <div>
    <button
      type="button"
      class="flex items-baseline gap-3 rounded-control border border-rule-strong bg-sheet px-3.5 py-2 text-sm outline-signal hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-haspopup="dialog"
      @click="dialog?.showModal()"
    >
      <span>{{ $t('header.outbound') }}</span>
      <span
        class="font-mono"
        :class="foreign.length > 0 ? 'text-alert' : 'text-signal'"
      >{{ label }}</span>
    </button>

    <dialog
      ref="dialog"
      aria-labelledby="network-title"
      class="m-0 mt-16 ml-auto max-h-[80vh] w-full max-w-xl border border-rule bg-sheet p-0 text-ink shadow-sheet backdrop:bg-ink/30 max-sm:mt-0 max-sm:max-h-full"
      @click.self="dialog?.close()"
    >
      <div class="space-y-4 px-6 py-5">
        <div class="flex items-start justify-between gap-4">
          <h2
            id="network-title"
            class="font-serif text-xl font-semibold"
          >
            {{ $t('header.outbound') }}
          </h2>
          <button
            type="button"
            class="text-sm text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
            @click="dialog?.close()"
          >
            {{ $t('network.close') }}
          </button>
        </div>
        <p
          class="font-semibold"
          :class="foreign.length > 0 ? 'text-alert' : 'text-signal'"
        >
          {{ foreign.length > 0 ? $t('network.foreign', { n: foreign.length }, foreign.length) : $t('network.none') }}
        </p>
        <p class="text-sm text-ink-muted">
          {{ $t('network.explain') }}
        </p>
        <div class="max-h-[45vh] overflow-y-auto border-y border-rule">
          <table class="w-full text-left text-sm">
            <thead class="sticky top-0 bg-sheet">
              <tr class="border-b border-rule">
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
                class="border-b border-rule last:border-b-0"
              >
                <td class="max-w-0 py-1.5 pr-3">
                  <span
                    class="block truncate font-mono text-xs"
                    :class="{ 'text-alert': !entry.own }"
                  >{{ entry.own ? entry.url : entry.host }}</span>
                </td>
                <td class="py-1.5 pr-3 whitespace-nowrap text-ink-muted">
                  {{ entry.own ? $t(`network.kind.${entry.kind}`) : $t('network.otherSite') }}
                </td>
                <td class="py-1.5 text-right whitespace-nowrap tabular-nums">
                  {{ size(entry.bytes) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p
          v-if="foreign.length === 0"
          class="text-sm text-ink-muted"
        >
          {{ $t('network.allOwn', { host: entries[0]?.host ?? '' }) }}
        </p>
      </div>
    </dialog>
  </div>
</template>
