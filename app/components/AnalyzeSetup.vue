<script setup lang="ts">
// Where the analysis runs (#124): the person's API key or Ollama on this
// computer, with a connection test that sends only "Hello".
import { ANTHROPIC, ANTHROPIC_MODELS, anthropicRequest, OLLAMA, ollamaModels, ollamaModelsRequest, ollamaRequest, TEST_TEXT, type AiProblem, type ModelChoice } from '~~/core/ai/providers'

// An example model: small enough for most laptops, good enough to test with.
const PULL = 'ollama pull llama3.2:3b'

const { where, model, key, remember, ollamaModel, tested } = useAiSettings()
const showKey = ref(false)
const modelName = computed(() => ANTHROPIC_MODELS.find(choice => choice.id === model.value)?.name ?? model.value)

type Test = { state: 'idle' | 'testing' } | { state: 'ok', model: string } | { state: 'failed', problem: AiProblem | 'needKey' }
const test = ref<Test>({ state: 'idle' })
watch([where, model, key, ollamaModel], () => (test.value = { state: 'idle' }))
// Analyze shows the step that sends once the test works for these settings.
watch(test, current => (tested.value = current.state === 'ok'))

// Once the test works, the settings fold into what they are, locked, with Change
// and Disconnect (#141). Focus moves to it: the Test button it came from is gone.
const tagging = useTagging()
const running = computed(() => ['running', 'merging', 'stopping'].includes(tagging.state.value))
const lastFour = computed(() => key.value.trim().slice(-4))
const connectedCard = useTemplateRef<HTMLElement>('connectedCard')
const form = useTemplateRef<HTMLElement>('form')
watch(tested, async (now, before) => {
  await nextTick()
  if (now && !before) connectedCard.value?.focus()
})
async function change() {
  test.value = { state: 'idle' }
  tested.value = false
  await nextTick()
  form.value?.querySelector<HTMLElement>('input:checked, input, select')?.focus()
}
/** Forgets the key (also on this device) or the chosen local model, and goes back to choosing. */
async function disconnect() {
  if (where.value === 'key') {
    remember.value = false
    key.value = ''
  }
  else {
    ollamaModel.value = undefined
  }
  await change()
}

async function testKey() {
  if (!key.value.trim()) {
    test.value = { state: 'failed', problem: 'needKey' }
    return
  }
  test.value = { state: 'testing' }
  const answer = await sendAiRequest(ANTHROPIC, anthropicRequest(key.value.trim(), model.value, TEST_TEXT))
  test.value = answer.ok ? { state: 'ok', model: modelName.value } : { state: 'failed', problem: answer.problem }
}

// Ollama: whether it answers this site, and which models it has.
const safari = ref(false)
const system = ref<'mac' | 'windows' | 'linux'>('mac')
const ollama = ref<{ state: 'unknown' | 'checking' | 'notFound' } | { state: 'found', models: ModelChoice[] }>({ state: 'unknown' })
const origin = ref('https://painfold.com')
const commands = computed(() => ({
  mac: `launchctl setenv OLLAMA_ORIGINS "${origin.value}"`,
  windows: `setx OLLAMA_ORIGINS "${origin.value}"`,
  linux: `sudo systemctl edit ollama.service   # add: Environment="OLLAMA_ORIGINS=${origin.value}"`,
}))
const copied = ref<string>()

onMounted(() => {
  origin.value = location.origin
  safari.value = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent)
  const platform = navigator.userAgent.toLowerCase()
  system.value = platform.includes('windows') ? 'windows' : platform.includes('linux') && !platform.includes('android') ? 'linux' : 'mac'
})

async function checkOllama() {
  ollama.value = { state: 'checking' }
  const answer = await sendAiRequest(OLLAMA, ollamaModelsRequest())
  if (!answer.ok) {
    ollama.value = { state: 'notFound' }
    return
  }
  let models: ModelChoice[] = []
  try {
    models = ollamaModels(JSON.parse(answer.body))
  }
  catch {
    // Not Ollama's answer: treated as no models.
  }
  ollama.value = { state: 'found', models }
  if (!models.some(choice => choice.id === ollamaModel.value)) ollamaModel.value = models[0]?.id
}

async function testOllama() {
  if (!ollamaModel.value) return
  test.value = { state: 'testing' }
  const answer = await sendAiRequest(OLLAMA, ollamaRequest(ollamaModel.value, TEST_TEXT))
  test.value = answer.ok ? { state: 'ok', model: ollamaModel.value } : { state: 'failed', problem: answer.problem }
}

watch(where, (now) => {
  if (now === 'local' && ollama.value.state === 'unknown' && !safari.value) void checkOllama()
})

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
  }
  catch {
    // Clipboard blocked: the command stays visible to copy by hand.
  }
}
</script>

<template>
  <section
    v-if="tested"
    ref="connectedCard"
    tabindex="-1"
    aria-labelledby="connected-title"
    class="rounded-md border border-line bg-surface p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2
          id="connected-title"
          class="flex items-center gap-2 font-medium"
        >
          <span
            aria-hidden="true"
            class="size-2 rounded-full bg-accent"
          />
          {{ $t('analyze.connected.title') }}
        </h2>
        <dl class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
          <dt class="text-fg-muted">
            {{ $t('analyze.connected.ai') }}
          </dt>
          <dd>{{ where === 'key' ? $t('analyze.connected.anthropic', { model: modelName }) : $t('analyze.connected.ollama', { model: ollamaModel }) }}</dd>
          <dt class="text-fg-muted">
            {{ $t('analyze.connected.how') }}
          </dt>
          <dd>{{ where === 'key' ? $t('analyze.connected.direct') : $t('analyze.connected.local') }}</dd>
          <template v-if="where === 'key'">
            <dt class="text-fg-muted">
              {{ $t('analyze.key.label') }}
            </dt>
            <dd>
              <span class="font-mono">{{ $t('analyze.connected.keyEnding', { last: lastFour }) }}</span>
              <span class="text-fg-muted">{{ remember ? $t('analyze.connected.remembered') : $t('analyze.connected.forgotten') }}</span>
            </dd>
          </template>
        </dl>
      </div>
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          class="focus-ring press h-9 rounded-md border border-line-strong bg-canvas px-3.5 text-sm hover:border-fg disabled:pointer-events-none disabled:opacity-50"
          :disabled="running"
          @click="change"
        >
          {{ $t('analyze.connected.change') }}
        </button>
        <button
          type="button"
          class="focus-ring press h-9 rounded-md border border-line-strong bg-canvas px-3.5 text-sm hover:border-fg disabled:pointer-events-none disabled:opacity-50"
          :disabled="running"
          @click="disconnect"
        >
          {{ $t('analyze.connected.disconnect') }}
        </button>
      </div>
    </div>
  </section>
  <div
    v-else
    ref="form"
  >
    <fieldset class="inline-flex rounded-md border border-line bg-surface p-0.5">
      <legend class="sr-only">
        {{ $t('analyze.where.label') }}
      </legend>
      <label
        v-for="option in (['key', 'local'] as const)"
        :key="option"
        class="press cursor-pointer rounded-sm px-3 py-1.5 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent"
        :class="where === option ? 'bg-canvas font-medium text-fg shadow-raised' : 'text-fg-muted hover:text-fg'"
      >
        <input
          v-model="where"
          type="radio"
          name="where"
          :value="option"
          class="sr-only"
        >
        {{ $t(`analyze.where.${option}`) }}
      </label>
    </fieldset>

    <section
      v-if="where === 'key'"
      class="mt-8 max-w-measure space-y-6"
      aria-labelledby="key-settings"
    >
      <h2
        id="key-settings"
        class="sr-only"
      >
        {{ $t('analyze.where.key') }}
      </h2>
      <!-- One provider for now: the key note says where the key goes. A provider choice joins here with OpenAI (#123). -->
      <div class="grid gap-x-6 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
        <label
          for="model"
          class="text-sm text-fg-muted sm:pt-2"
        >{{ $t('analyze.model') }}</label>
        <div>
          <select
            id="model"
            v-model="model"
            class="focus-ring h-9 w-full max-w-xs rounded-md border border-line-strong bg-canvas px-2.5"
            aria-describedby="model-note"
          >
            <option
              v-for="choice in ANTHROPIC_MODELS"
              :key="choice.id"
              :value="choice.id"
            >
              {{ choice.name }}
            </option>
          </select>
          <p
            id="model-note"
            class="mt-1 text-sm text-fg-muted"
          >
            {{ $t(`analyze.modelNote.${model}`) }}
          </p>
        </div>
      </div>

      <div class="grid gap-x-6 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
        <label
          for="api-key"
          class="text-sm text-fg-muted sm:pt-2"
        >{{ $t('analyze.key.label') }}</label>
        <div>
          <div class="flex gap-2">
            <input
              id="api-key"
              v-model="key"
              :type="showKey ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              class="focus-ring h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-canvas px-2.5 font-mono text-sm"
              aria-describedby="key-note"
            >
            <button
              type="button"
              class="focus-ring press h-9 rounded-md border border-line px-3 text-sm hover:border-line-strong"
              :aria-pressed="showKey"
              @click="showKey = !showKey"
            >
              {{ showKey ? $t('analyze.key.hide') : $t('analyze.key.show') }}
            </button>
          </div>
          <p
            id="key-note"
            class="mt-1 text-sm text-fg-muted"
          >
            {{ $t('aiPrivacy.keyNote') }}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            >{{ $t('analyze.key.get') }}<span class="sr-only"> {{ $t('analyze.key.newTab') }}</span></a>
          </p>
          <label class="mt-3 flex items-start gap-2 text-sm">
            <input
              v-model="remember"
              type="checkbox"
              class="focus-ring mt-0.5 size-4 accent-fg"
              aria-describedby="remember-note"
            >
            <span>
              {{ $t('analyze.key.remember') }}
              <span
                id="remember-note"
                class="block text-fg-muted"
              >{{ $t('aiPrivacy.rememberNote') }}</span>
            </span>
          </label>
        </div>
      </div>

      <div class="border-t border-line pt-6">
        <button
          type="button"
          class="focus-ring press h-9 rounded-md bg-fg px-3.5 font-medium text-canvas disabled:opacity-50"
          :disabled="test.state === 'testing'"
          @click="testKey"
        >
          {{ test.state === 'testing' ? $t('analyze.test.testing') : $t('analyze.test.button') }}
        </button>
        <p class="mt-2 text-sm text-fg-muted">
          {{ $t('aiPrivacy.testNote') }}
        </p>
      </div>
    </section>

    <section
      v-else
      class="mt-8 max-w-measure"
      aria-labelledby="local-settings"
    >
      <h2
        id="local-settings"
        class="sr-only"
      >
        {{ $t('analyze.where.local') }}
      </h2>
      <p class="text-sm text-fg-muted">
        {{ $t('aiPrivacy.localNote') }}
      </p>
      <p
        v-if="safari"
        class="mt-4 text-sm text-danger"
        role="alert"
      >
        {{ $t('analyze.ollama.safari') }}
      </p>
      <template v-else>
        <p class="mt-6 text-sm font-medium">
          {{ $t('analyze.ollama.steps') }}
        </p>
        <ol class="mt-3 list-decimal space-y-5 pl-6 marker:font-mono marker:text-sm marker:text-fg-muted">
          <li>
            <div>
              <p class="font-medium">
                {{ $t('analyze.ollama.install') }}
              </p>
              <p class="mt-1 text-sm text-fg-muted">
                {{ $t('analyze.ollama.installNote') }}
              </p>
              <code class="mt-2 block rounded-sm bg-surface px-2 py-1.5 font-mono text-sm">{{ PULL }}</code>
            </div>
          </li>
          <li>
            <div>
              <p class="font-medium">
                {{ $t('analyze.ollama.origins') }}
              </p>
              <p class="mt-1 text-sm text-fg-muted">
                {{ $t('analyze.ollama.originsNote') }}
              </p>
              <label class="mt-2 flex items-center gap-2 text-sm">
                <span class="text-fg-muted">{{ $t('analyze.ollama.system') }}</span>
                <select
                  v-model="system"
                  class="focus-ring h-8 rounded-md border border-line-strong bg-canvas px-2"
                >
                  <option
                    v-for="option in (['mac', 'windows', 'linux'] as const)"
                    :key="option"
                    :value="option"
                  >
                    {{ $t(`analyze.ollama.systems.${option}`) }}
                  </option>
                </select>
              </label>
              <div class="mt-2 flex items-start gap-2">
                <code class="block min-w-0 flex-1 rounded-sm bg-surface px-2 py-1.5 font-mono text-sm break-all">{{ commands[system] }}</code>
                <button
                  type="button"
                  class="focus-ring press h-8 shrink-0 rounded-md border border-line px-2.5 text-sm hover:border-line-strong"
                  @click="copy(commands[system])"
                >
                  {{ copied === commands[system] ? $t('analyze.ollama.copied') : $t('analyze.ollama.copy') }}
                </button>
              </div>
            </div>
          </li>
          <li>
            <div>
              <p class="font-medium">
                {{ $t('analyze.ollama.permission') }}
              </p>
              <p class="mt-1 text-sm text-fg-muted">
                {{ $t('analyze.ollama.permissionNote') }}
              </p>
            </div>
          </li>
        </ol>

        <div class="mt-6 border-t border-line pt-6">
          <p
            role="status"
            class="text-sm"
            :class="ollama.state === 'notFound' ? 'text-danger' : 'text-fg-muted'"
          >
            <template v-if="ollama.state === 'checking'">
              {{ $t('analyze.ollama.checking') }}
            </template>
            <template v-else-if="ollama.state === 'notFound'">
              {{ $t('analyze.ollama.notFound') }}
            </template>
            <template v-else-if="ollama.state === 'found'">
              {{ ollama.models.length > 0 ? $t('analyze.ollama.found') : $t('analyze.ollama.noModels') }}
            </template>
          </p>
          <div
            v-if="ollama.state === 'found' && ollama.models.length > 0"
            class="mt-4 flex flex-wrap items-center gap-3"
          >
            <label
              for="ollama-model"
              class="text-sm text-fg-muted"
            >{{ $t('analyze.model') }}</label>
            <select
              id="ollama-model"
              v-model="ollamaModel"
              class="focus-ring h-9 rounded-md border border-line-strong bg-canvas px-2.5"
            >
              <option
                v-for="choice in ollama.models"
                :key="choice.id"
                :value="choice.id"
              >
                {{ choice.name }}
              </option>
            </select>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="focus-ring press h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
              :disabled="ollama.state === 'checking'"
              @click="checkOllama"
            >
              {{ $t('analyze.ollama.check') }}
            </button>
            <button
              v-if="ollama.state === 'found' && ollamaModel"
              type="button"
              class="focus-ring press h-9 rounded-md bg-fg px-3.5 font-medium text-canvas disabled:opacity-50"
              :disabled="test.state === 'testing'"
              @click="testOllama"
            >
              {{ test.state === 'testing' ? $t('analyze.test.testing') : $t('analyze.test.button') }}
            </button>
          </div>
          <p class="mt-2 text-sm text-fg-muted">
            {{ $t('aiPrivacy.testNote') }}
          </p>
        </div>
      </template>
    </section>

    <p
      v-if="test.state === 'ok' || test.state === 'failed'"
      role="status"
      class="mt-4 max-w-measure text-sm"
      :class="test.state === 'ok' ? 'text-fg' : 'text-danger'"
    >
      <template v-if="test.state === 'ok'">
        {{ where === 'key' ? $t('analyze.test.ok', { model: test.model }) : $t('analyze.test.okLocal', { model: test.model }) }}
      </template>
      <template v-else-if="test.problem === 'needKey'">
        {{ $t('analyze.test.needKey') }}
      </template>
      <template v-else>
        {{ where === 'key' ? $t(`analyze.problem.${test.problem}`, { model: modelName }) : $t('analyze.ollama.notFound') }}
      </template>
    </p>
  </div>
</template>
