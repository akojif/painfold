<script setup lang="ts">
const { table, suggestions, roles, feedbackColumn } = useSession()

function example(index: number): string {
  return table.value?.rows.find(row => row[index]?.trim())?.[index]?.trim() ?? ''
}
</script>

<template>
  <section v-if="table">
    <h2 class="text-xl font-semibold">
      {{ $t('columns.heading') }}
    </h2>
    <ul class="mt-4 divide-y divide-rule border-y border-rule">
      <li
        v-for="(column, index) in table.columns"
        :key="column"
        class="grid gap-x-6 gap-y-2 py-3 md:grid-cols-[12rem_minmax(0,1fr)_17rem] md:items-start"
      >
        <span class="font-semibold break-words">{{ column }}</span>
        <span class="truncate text-ink-muted">{{ example(index) || $t('columns.empty') }}</span>
        <div class="md:text-right">
          <p
            v-if="index === feedbackColumn"
            class="text-sm text-ink-muted"
          >
            {{ $t('columns.isFeedback') }}
          </p>
          <template v-else>
            <RoleControl
              v-model="roles[index]!"
              :column="column"
              :name="`role-${index}`"
            />
            <p
              v-if="roles[index] === 'keep'"
              class="mt-1 text-sm text-ink-muted"
            >
              {{ $t('columns.keepHelp') }}
            </p>
            <p
              v-else-if="roles[index] === 'drop' && suggestions[index]?.reason === 'personal-header'"
              class="mt-1 text-sm text-ink-muted"
            >
              {{ $t('columns.personal', { term: suggestions[index].term }) }}
            </p>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>
