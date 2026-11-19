<script setup lang="ts">
// The demo offer on Analyze (#130): for the sample file, a stored real run shows the report without an API key.
const { locale } = useI18n()
const localePath = useLocalePath()
// The demo (#130): for the sample file, a stored real run shows the report
// without an API key. Loading it sends nothing.
const { isSample } = useSession()
const tagging = useTagging()
const loadingDemo = ref(false)
async function showDemo() {
  loadingDemo.value = true
  try {
    await tagging.loadDemo(locale.value === 'de' ? 'de' : 'en')
    await navigateTo(localePath('/report'))
  }
  finally {
    loadingDemo.value = false
  }
}
</script>

<template>
  <div
    v-if="isSample"
    class="max-w-measure rounded-md border border-line bg-surface px-4 py-3 text-sm"
  >
    <p>{{ tagging.demo.value ? $t('analyze.demo.shown') : $t('analyze.demo.offer') }}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <template v-if="tagging.demo.value">
        <NuxtLink
          :to="localePath('/report')"
          class="focus-ring press inline-flex h-9 items-center rounded-md bg-fg px-3.5 font-medium text-canvas"
        >
          {{ $t('analyze.demo.report') }}
        </NuxtLink>
        <button
          type="button"
          class="focus-ring press h-9 rounded-md border border-line-strong bg-canvas px-3.5 font-medium hover:border-fg"
          @click="tagging.reset()"
        >
          {{ $t('analyze.demo.leave') }}
        </button>
      </template>
      <button
        v-else
        type="button"
        class="focus-ring press h-9 rounded-md border border-line-strong bg-canvas px-3.5 font-medium hover:border-fg disabled:opacity-50"
        :disabled="loadingDemo"
        @click="showDemo"
      >
        {{ $t('analyze.demo.show') }}
      </button>
    </div>
  </div>
</template>
