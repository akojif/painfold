// `npm run test:model`: tests that run the real name model. Kept apart from the
// unit tests because they need the model files (`npm run models`) and take longer.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/model/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
