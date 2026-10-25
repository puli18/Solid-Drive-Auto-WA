import { defineConfig } from 'vitest/config';

// Unit tests only. Emulator tests: `pnpm test:emulator` (vitest.emulator.config.ts).
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], exclude: ['test/emulator/**', '**/node_modules/**'], environment: 'node' },
});
