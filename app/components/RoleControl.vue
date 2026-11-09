<script setup lang="ts">
import type { ColumnRole } from '~~/core/columns/roles'

defineProps<{ column: string, name: string }>()
const model = defineModel<ColumnRole>({ required: true })
const options: ColumnRole[] = ['scan', 'keep', 'drop']
</script>

<template>
  <fieldset class="inline-flex rounded-md border border-line bg-surface p-0.5">
    <legend class="sr-only">
      {{ $t('columns.roleLabel', { column }) }}
    </legend>
    <label
      v-for="option in options"
      :key="option"
      class="press cursor-pointer rounded-sm px-2.5 py-1 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent"
      :class="model === option ? 'bg-canvas font-medium text-fg shadow-raised' : 'text-fg-muted hover:text-fg'"
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
