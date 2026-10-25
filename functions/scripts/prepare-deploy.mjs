// Writes lib/package.json (runtime deps only, no workspace: refs) and copies emulator env files,
// so `firebase.json` can use `"source": "functions/lib"` for both deploy and the emulator.
import { copyFileSync, existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const out = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  main: 'index.js',
  engines: pkg.engines,
  dependencies: pkg.dependencies,
};
writeFileSync(join(root, 'lib', 'package.json'), JSON.stringify(out, null, 2) + '\n');
for (const f of ['.env', '.env.local', '.env.demo-solid-drive', '.env.dealership-staging', '.env.dealership-prod', '.secret.local']) {
  if (existsSync(join(root, f))) copyFileSync(join(root, f), join(root, 'lib', f));
}
// The emulator/deploy CLI looks for `<source>/node_modules/.bin/firebase-functions`; point lib/node_modules
// at the workspace's functions/node_modules (ignored on deploy via firebase.json "ignore").
if (!existsSync(join(root, 'lib', 'node_modules'))) symlinkSync('../node_modules', join(root, 'lib', 'node_modules'), 'dir');
console.log('functions/lib ready for deploy/emulator');
