import tailwindcss from '@tailwindcss/vite'
import { MODEL_BYTES, MODEL_PATH, ORT_PREFIX } from './deploy/model'
import { ortBytes, ortVersion } from './deploy/ort-version'
import { version } from './package.json'

// Painfold is a fully static site: everything that touches a user's file runs
// in the browser. There are no server routes, so there is nowhere for data to go.
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/i18n'],
  ssr: true,
  devtools: { enabled: false },

  app: {
    head: {
      title: 'Painfold',
      script: [
        // Applies a saved Light or Dark choice before first paint, so the page
        // never flashes the wrong theme. scripts/apply-csp.ts hashes it into the CSP.
        { innerHTML: "try{var t=localStorage.getItem('painfold-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" },
        // Only the root decides the language: it opens /de/ before first paint if
        // German was chosen, or if nothing was chosen and the browser prefers German.
        // Every other address keeps its language, so a shared /de/ link stays German.
        { innerHTML: "try{if(location.pathname==='/'){var l=localStorage.getItem('painfold-language');if(l==='de'||(!l&&/^de\\b/i.test(navigator.language)))location.replace('/de'+location.search+location.hash)}}catch(e){}" },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  // The cleaning report names the Painfold version that produced it.
  // The name model and its runtime are served from this site, never from Hugging Face or a CDN.
  // downloadBytes is what a first download costs (model and runtime), shown before it starts.
  runtimeConfig: {
    public: {
      version,
      modelPath: MODEL_PATH,
      ortPath: `${ORT_PREFIX}${ortVersion()}/`,
      downloadBytes: MODEL_BYTES + ortBytes(),
    },
  },

  compatibilityDate: '2026-11-01',

  nitro: {
    preset: 'static',
    prerender: { routes: ['/roadmap', '/accuracy', '/de', '/de/roadmap', '/de/accuracy'] },
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // transformers.js imports the WebGPU build of ONNX Runtime; the plain WebAssembly
      // build is the same API without the WebGPU kernels, half the download (14 MB).
      alias: { 'onnxruntime-web/webgpu': 'onnxruntime-web/wasm' },
    },
  },

  typescript: {
    strict: true,
  },

  telemetry: false,

  eslint: {
    config: {
      stylistic: true,
    },
  },

  // English at /, German under /de/, so German pages can be shared and indexed.
  // German uses de-AT, so numbers, lists and dates follow Austrian conventions.
  // Nuxt i18n's own detection would set a cookie; the inline script above and
  // the language switch (localStorage) choose the language instead.
  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    baseUrl: 'https://painfold.vercel.app',
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'de', language: 'de-AT', name: 'Deutsch', file: 'de.json' },
    ],
    detectBrowserLanguage: false,
  },
})
