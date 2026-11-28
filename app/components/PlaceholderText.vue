<script setup lang="ts">
// Cleaned text with its placeholders ([NAME_1]) shown as the same tokens as in
// the review, so the redaction reads the same everywhere. No motion here.
import { quoteParts } from '~~/core/ai/results'

const props = defineProps<{ text: string }>()
const parts = computed(() => quoteParts(props.text))
</script>

<template>
  <template
    v-for="(part, index) in parts"
    :key="index"
  >
    <RedactionToken
      v-if="part.placeholder"
      :placeholder="part.text"
    />
    <span v-else>{{ part.text }}</span>
  </template>
</template>
