import { defineConfig } from 'tsup';

/**
 * Bundles src/index.ts → lib/index.js (CommonJS, Node 20).
 * `@sda/shared` (a workspace devDependency exporting TS source) is INLINED so the deployed
 * package has no `workspace:` dependency. Everything in package.json "dependencies" stays external
 * and is installed by Cloud Build from the generated lib/package.json (scripts/prepare-deploy.mjs).
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  // Never `clean: true`: it follows the lib/node_modules symlink. scripts/clean-lib.mjs empties lib safely.
  clean: false,
  splitting: false,
  noExternal: ['@sda/shared'],
});
