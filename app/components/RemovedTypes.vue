<script setup lang="ts">
import { DETECTED_TYPES } from '~~/core/detect'
import { placeholderLabel } from '~~/core/redact/placeholders'

// Generated from the detectors that exist, so the list never promises more.
const namesDetected = DETECTED_TYPES.includes('NAME')
</script>

<template>
  <div>
    <p
      id="removed-heading"
      class="text-sm text-ink-muted"
    >
      {{ $t('start.removedHeading') }}
    </p>
    <ul
      aria-labelledby="removed-heading"
      class="mt-2 flex flex-wrap gap-2"
    >
      <li
        v-for="type in DETECTED_TYPES"
        :key="type"
        class="bg-redaction px-2 py-0.5 font-mono text-sm text-on-redaction"
      >
        <span aria-hidden="true">[{{ placeholderLabel(type) }}]</span>
        <span class="sr-only">{{ $t(`types.${type}`) }}</span>
      </li>
      <li
        v-if="!namesDetected"
        class="border border-dashed border-rule-strong px-2 py-0.5 font-mono text-sm text-ink-muted"
      >
        <span aria-hidden="true">{{ $t('start.nameNext', { token: `[${placeholderLabel('NAME')}]` }) }}</span>
        <span class="sr-only">{{ $t('start.nameNext', { token: $t('types.NAME') }) }}</span>
      </li>
    </ul>
  </div>
</template>
