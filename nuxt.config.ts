import tailwindcss from '@tailwindcss/vite'
import { version } from './package.json'

// Painfold is a fully static site: everything that touches a user's file runs
// in the browser. There are no server routes, so there is nowhere for data to go.
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/i18n'],
  ssr: true,
  devtools: { enabled: false },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Painfold',
    },
  },

  css: ['~/assets/css/main.css'],

  // The cleaning report names the Painfold version that produced it.
  runtimeConfig: {
    public: { version },
  },

  compatibilityDate: '2026-11-01',

  nitro: {
    preset: 'static',
  },

  vite: {
    plugins: [tailwindcss()],
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

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [{ code: 'en', language: 'en', file: 'en.json' }],
    // One language for now, and no cookie: nothing to detect or remember.
    detectBrowserLanguage: false,
  },
})
