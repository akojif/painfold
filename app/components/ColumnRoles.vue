<script setup lang="ts">
const { table, suggestions, roles, feedbackColumn } = useSession()

function example(index: number): string {
  return table.value?.rows.find(row => row[index]?.trim())?.[index]?.trim() ?? ''
}
</script>

<template>
  <section v-if="table">
    <h2 class="text-md font-semibold">
      {{ $t('columns.heading') }}
    </h2>
    <p class="mt-1 max-w-measure text-sm text-fg-muted">
      {{ $t('columns.help') }}
    </p>
    <ul class="mt-3 divide-y divide-line rounded-md border border-line">
      <li
        v-for="(column, index) in table.columns"
        :key="column"
        class="grid gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)_auto] md:items-center"
      >
        <span class="font-medium break-words">{{ column }}</span>
        <div class="min-w-0">
          <p class="truncate font-mono text-sm text-fg-muted">
            {{ example(index) || $t('columns.empty') }}
          </p>
          <p
            v-if="index !== feedbackColumn && roles[index] === 'drop' && suggestions[index]?.reason === 'personal-header'"
            class="mt-0.5 text-sm text-fg-muted"
          >
            {{ $t('columns.personal', { term: suggestions[index].term }) }}
          </p>
        </div>
        <p
          v-if="index === feedbackColumn"
          class="text-sm text-fg-muted"
        >
          {{ $t('columns.isFeedback') }}
        </p>
        <RoleControl
          v-else
          v-model="roles[index]!"
          :column="column"
          :name="`role-${index}`"
        />
      </li>
    </ul>
  </section>
</template>
