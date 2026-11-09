import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Feedback text and detected values must never reach the console.
      'no-console': 'error',
    },
  },
  {
    files: ['app/**/*.vue'],
    rules: {
      // All interface text goes through i18n.
      'vue/no-bare-strings-in-template': 'error',
    },
  },
  {
    files: ['core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['vue', 'vue-router', 'nuxt', 'nuxt/*', '#*', '@nuxt/*', '@nuxtjs/*', '~/*', '@/*', '~~/*', '@@/*'], message: 'core/ is framework-free; keep Vue and Nuxt imports in app/.' },
          { group: ['../app/*', '../../app/*'], message: 'core/ must not depend on app/.' },
        ],
      }],
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
