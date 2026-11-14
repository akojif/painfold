import { ANTHROPIC_MODELS } from '~~/core/ai/providers'

// Where the analysis runs (Stage 3): the person's API key or Ollama on this
// computer. Held for this visit in memory. The API key is only stored when the
// person asks for it ("Remember on this device"), in this browser's storage,
// and is removed again when they untick it.
const STORAGE_KEY = 'painfold.anthropic-key'

const where = ref<'key' | 'local'>('key')
const model = ref(ANTHROPIC_MODELS[0]!.id)
const key = ref('')
const remember = ref(false)
const ollamaModel = ref<string>()
let loaded = false

function readStored(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined
  }
  catch {
    return undefined
  }
}

function writeStored(value: string | undefined) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  }
  catch {
    // Storage blocked: the key stays in memory for this visit only.
  }
}

export function useAiSettings() {
  if (import.meta.client && !loaded) {
    loaded = true
    const stored = readStored()
    if (stored) {
      key.value = stored
      remember.value = true
    }
    // Detached, so it keeps working after the page that first asked is gone.
    effectScope(true).run(() => watch([key, remember], ([current, keep]) => writeStored(keep ? current.trim() : undefined)))
  }

  /** Forgets the key from memory; a key the person chose to remember stays stored. */
  function forgetKey() {
    if (!remember.value) key.value = ''
  }

  return { where, model, key, remember, ollamaModel, forgetKey }
}
