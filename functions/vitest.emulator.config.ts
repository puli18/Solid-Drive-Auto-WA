import { defineConfig } from 'vitest/config';

/**
 * Integration tests against the Firestore / Auth / Storage emulators (non-default ports, see EMULATOR_PORTS).
 * Run with `pnpm --filter functions test:emulator` (starts the emulators via firebase emulators:exec),
 * or `pnpm --filter functions test:emulator:run` when they are already running.
 */
export default defineConfig({
  test: {
    include: ['test/emulator/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/emulator/env.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
