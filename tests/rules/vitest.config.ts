import { defineConfig } from 'vitest/config';

// Run with `pnpm test:rules` (starts the Firestore + Storage emulators via firebase emulators:exec),
// or `pnpm test:rules:run` when the emulators are already running.
export default defineConfig({
  test: {
    root: __dirname,
    include: ['**/*.rules.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
