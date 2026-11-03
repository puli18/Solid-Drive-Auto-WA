import { defineConfig } from 'vitest/config';

// Unit tests for the pure parts of the seed scripts (no network, no emulators). `pnpm test:scripts`.
export default defineConfig({
  test: {
    root: __dirname,
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
