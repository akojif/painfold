<script setup lang="ts">
const { t } = useI18n()
const { number } = useFormat()
const { bytes } = useOutboundTraffic()
const label = computed(() => t('header.bytes', { n: number(bytes.value) }, bytes.value))
</script>

<template>
  <p
    class="flex items-baseline gap-3 rounded-control border border-rule-strong bg-sheet px-3.5 py-2 text-sm"
    role="status"
  >
    <span>{{ $t('header.outbound') }}</span>
    <span class="font-mono text-signal">{{ label }}</span>
  </p>
</template>
