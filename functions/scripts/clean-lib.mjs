// Empties functions/lib WITHOUT following symlinks. tsup's `clean: true` globbed through the
// lib/node_modules -> ../node_modules symlink (created by prepare-deploy.mjs) and deleted files in
// functions/node_modules, the root node_modules/.pnpm store and packages/shared (via @sda/shared).
// fs.rmSync on a symlink removes the link itself only.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
if (existsSync(lib)) {
  for (const entry of readdirSync(lib)) rmSync(join(lib, entry), { recursive: true, force: true });
}
