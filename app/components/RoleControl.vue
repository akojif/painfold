<script setup lang="ts">
import type { ColumnRole } from '~~/core/columns/roles'

defineProps<{ column: string, name: string }>()
const model = defineModel<ColumnRole>({ required: true })
const options: ColumnRole[] = ['scan', 'keep', 'drop']
</script>

<template>
  <fieldset class="inline-flex">
    <legend class="sr-only">
      {{ $t('columns.roleLabel', { column }) }}
    </legend>
    <label
      v-for="option in options"
      :key="option"
      class="-ml-px cursor-pointer border border-rule-strong px-3 py-1 text-sm outline-signal first:ml-0 first:rounded-l-control last:rounded-r-control has-focus-visible:relative has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
      :class="model === option ? 'border-ink bg-ink text-desk font-semibold' : 'bg-sheet text-ink hover:border-ink'"
    >
      <input
        v-model="model"
        type="radio"
        :name="name"
        :value="option"
        class="sr-only"
      >
      {{ $t(`columns.roles.${option}`) }}
    </label>
  </fieldset>
</template>
