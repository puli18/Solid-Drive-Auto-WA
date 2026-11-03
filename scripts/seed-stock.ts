/**
 * `pnpm seed:stock` – writes the dealer's stock (scripts/data/stock.ts) and first-time settings to a
 * Firebase project with firebase-admin. DRY RUN by default: prints what would be written.
 *
 *   pnpm seed:stock --project solid-drive-auto-wa            # dry run against the real project (reads only)
 *   pnpm seed:stock --project solid-drive-auto-wa --write    # write
 *   pnpm seed:stock --emulator --write                       # local emulators (project demo-solid-drive)
 *
 * Flags:
 *   --project <id>         target project (required unless --emulator)
 *   --emulator             use the local Emulator Suite (default project demo-solid-drive)
 *   --write                actually write (otherwise dry run)
 *   --overwrite            replace cars that already exist (default: skip them)
 *   --overwrite-settings   replace existing settings/* docs (default: only create missing ones)
 *   --upload-images        upload the webp photos to Storage (cars/<carId>/NN.webp) and store https
 *                          download URLs as image ids instead of `local:cars/...`
 *   --bucket <name>        Storage bucket for --upload-images (default <project>.firebasestorage.app)
 *
 * Never deletes anything. Cars use deterministic ids (car-sda1001 ...). No carFinancials are written: they
 * are optional (the admin shows "no purchase details" until someone enters them) and the purchase data is
 * not known. Credentials: Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC).
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { carTitle, EMULATOR_HOST, EMULATOR_PORTS, formatAUD } from '@sda/shared';
import type { SettingsDocs } from '@sda/shared/demo';
import { STOCK_CARS, type StockCarFixture } from './data/stock';
import { docData } from './lib/firestore-admin';
import {
  buildStockCarDocs,
  buildStockSettingsDocs,
  localImageId,
  SEED_STOCK_ACTOR,
  stockCarId,
  validateCarDoc,
  validateSettingsDoc,
} from './lib/stock-docs';

const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = resolve(ROOT, 'apps/web/public/images/cars');
const EMULATOR_PROJECT = 'demo-solid-drive';

class UsageError extends Error {}

function parse() {
  const { values } = parseArgs({
    options: {
      project: { type: 'string' },
      emulator: { type: 'boolean', default: false },
      write: { type: 'boolean', default: false },
      overwrite: { type: 'boolean', default: false },
      'overwrite-settings': { type: 'boolean', default: false },
      'upload-images': { type: 'boolean', default: false },
      bucket: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.help) {
    console.log('Usage: pnpm seed:stock --project <id> [--write] [--overwrite] [--overwrite-settings] [--upload-images [--bucket <name>]]');
    console.log('       pnpm seed:stock --emulator [--write] ...');
    process.exit(0);
  }
  const project = values.project ?? (values.emulator ? EMULATOR_PROJECT : undefined);
  if (!project) throw new UsageError('--project <id> is required (or --emulator for the local emulators).');
  if (values.emulator && !project.startsWith('demo-')) {
    throw new UsageError(`--emulator expects a demo- project id (got "${project}"); the emulators run as ${EMULATOR_PROJECT}.`);
  }
  if (!values.emulator && project.startsWith('demo-')) {
    throw new UsageError(`"${project}" is an emulator-only project id. Add --emulator (and start them with \`pnpm emulators\`).`);
  }
  return { ...values, project };
}

/** Refuse to touch a real project without credentials, with a hint where to find them. */
function checkCredentials() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    if (!existsSync(envPath)) throw new UsageError(`GOOGLE_APPLICATION_CREDENTIALS points to a missing file: ${envPath}`);
    return envPath;
  }
  const gcloud = join(homedir(), '.config/gcloud/application_default_credentials.json');
  if (existsSync(gcloud)) return gcloud;
  const fbDir = join(homedir(), '.config/firebase');
  const candidates = existsSync(fbDir) ? readdirSync(fbDir).filter((f) => f.endsWith('_application_default_credentials.json')) : [];
  const hint = candidates.length
    ? `Found a Firebase CLI credentials file; run with:\n  GOOGLE_APPLICATION_CREDENTIALS="${join(fbDir, candidates[0]!)}" pnpm seed:stock ...`
    : 'Create them with `gcloud auth application-default login` (or point GOOGLE_APPLICATION_CREDENTIALS at a service-account key).';
  throw new UsageError(`No Application Default Credentials found.\n${hint}`);
}

const photoPath = (c: StockCarFixture, file: string) => join(PHOTO_DIR, c.photoKey, file);

function downloadUrl(bucket: string, path: string, token: string, emulator: boolean) {
  const base = emulator ? `http://${EMULATOR_HOST}:${EMULATOR_PORTS.storage}` : 'https://firebasestorage.googleapis.com';
  return `${base}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

async function main() {
  const args = parse();
  const mode = args.write ? 'WRITE' : 'DRY RUN';
  if (args.emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= `${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}`;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${EMULATOR_HOST}:${EMULATOR_PORTS.storage}`;
  }
  const creds = args.emulator ? null : checkCredentials();

  console.log(`seed:stock  ${mode}  project=${args.project}${args.emulator ? `  (emulators: Firestore ${process.env.FIRESTORE_EMULATOR_HOST})` : ''}`);
  if (creds) console.log(`  credentials: ${creds}`);
  console.log(`  options: overwrite=${args.overwrite} overwrite-settings=${args['overwrite-settings']} upload-images=${args['upload-images']}`);

  const app = initializeApp(
    args.emulator ? { projectId: args.project } : { projectId: args.project, credential: applicationDefault() },
    'seed-stock',
  );
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });

  // ---- build + validate (before any write) ----
  const now = new Date();
  const imageUrls = new Map<string, string>(); // `${carId}/${file}` → download URL (--upload-images)
  const bucketName = args.bucket ?? `${args.project}.firebasestorage.app`;
  const cars = buildStockCarDocs({
    now,
    actor: SEED_STOCK_ACTOR,
    imageId: (c, carId, file) => imageUrls.get(`${carId}/${file}`) ?? localImageId(c.photoKey, file),
  });
  const settings = buildStockSettingsDocs({ now, actor: SEED_STOCK_ACTOR });

  let invalid = 0;
  for (const car of cars) {
    const errs = validateCarDoc(car);
    if (errs.length) {
      invalid++;
      console.error(`  INVALID ${car.id}:\n    ${errs.join('\n    ')}`);
    }
  }
  for (const [id, data] of Object.entries(settings) as [keyof SettingsDocs, Record<string, unknown>][]) {
    const errs = validateSettingsDoc(id, data);
    if (errs.length) {
      invalid++;
      console.error(`  INVALID settings/${id}:\n    ${errs.join('\n    ')}`);
    }
  }
  if (invalid) throw new Error(`${invalid} document(s) failed schema validation – nothing was written.`);

  const missingPhotos = STOCK_CARS.flatMap((c) => c.photos.filter((p) => !existsSync(photoPath(c, p.file))).map((p) => `${c.photoKey}/${p.file}`));
  if (missingPhotos.length) {
    console.warn(`  WARNING: ${missingPhotos.length} photo file(s) missing under apps/web/public/images/cars: ${missingPhotos.join(', ')}`);
    if (args['upload-images']) throw new Error('Cannot upload missing photos – nothing was written.');
  }

  // ---- what exists already ----
  let existing: Set<string>;
  let existingSettings: Set<string>;
  try {
    const carSnaps = await db.getAll(...cars.map((c) => db.doc(`cars/${c.id}`)));
    existing = new Set(carSnaps.filter((s) => s.exists).map((s) => s.id));
    const setSnaps = await db.getAll(...Object.keys(settings).map((id) => db.doc(`settings/${id}`)));
    existingSettings = new Set(setSnaps.filter((s) => s.exists).map((s) => s.id));
  } catch (err) {
    const hint = args.emulator
      ? 'Are the emulators running? Start them with `pnpm emulators`.'
      : 'Check the credentials have access to this project and that Firestore is enabled.';
    console.error(`\nCould not read from Firestore. ${hint}\n`);
    throw err;
  }

  const carPlan = cars.map((c) => ({ car: c, action: !existing.has(c.id) ? 'create' : args.overwrite ? 'overwrite' : 'skip' }) as const);
  const settingsPlan = (Object.keys(settings) as (keyof SettingsDocs)[]).map(
    (id) => ({ id, action: !existingSettings.has(id) ? 'create' : args['overwrite-settings'] ? 'overwrite' : 'skip' }) as const,
  );
  const verb = (a: 'create' | 'overwrite' | 'skip') =>
    a === 'skip' ? 'exists – skip' : args.write ? (a === 'create' ? 'create' : 'overwrite') : `would ${a}`;

  // ---- images (optional) ----
  if (args['upload-images']) {
    const bucket = getStorage(app).bucket(bucketName);
    const [exists] = await bucket.exists().catch((err: unknown) => {
      throw new Error(`Could not check Storage bucket gs://${bucketName}: ${err instanceof Error ? err.message : String(err)}`);
    });
    if (!exists) {
      throw new Error(
        `Storage bucket gs://${bucketName} does not exist. Create it first (Firebase console → Storage → Get started), ` +
          'or pass --bucket <name>. Without --upload-images the cars keep their local:cars/... photo ids (served by the site).',
      );
    }
    const toUpload = carPlan.filter((p) => p.action !== 'skip');
    console.log(`\nImages → gs://${bucketName}`);
    for (const { car } of toUpload) {
      const fx = STOCK_CARS.find((c) => stockCarId(c.stockNo) === car.id)!;
      for (const p of fx.photos) {
        const dest = `cars/${car.id}/${p.file}`;
        if (!args.write) {
          console.log(`  would upload ${fx.photoKey}/${p.file} → ${dest}`);
          continue;
        }
        const token = randomUUID();
        await bucket.upload(photoPath(fx, p.file), {
          destination: dest,
          metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } },
        });
        imageUrls.set(`${car.id}/${p.file}`, downloadUrl(bucketName, dest, token, args.emulator));
        console.log(`  uploaded ${dest}`);
      }
    }
    if (!toUpload.length) console.log('  nothing to upload (all cars exist; use --overwrite to replace them)');
  }
  // Rebuild so the image ids pick up the uploaded URLs (same `now` → same dates).
  const finalCars = imageUrls.size
    ? buildStockCarDocs({ now, actor: SEED_STOCK_ACTOR, imageId: (c, carId, file) => imageUrls.get(`${carId}/${file}`) ?? localImageId(c.photoKey, file) })
    : cars;

  // ---- report + write ----
  console.log('\nCars');
  for (const { car, action } of carPlan) {
    const doc = finalCars.find((c) => c.id === car.id)!;
    const images = doc.images as { id: string }[];
    const price = (doc.priceCents as number) ? formatAUD(doc.priceCents as number) : 'Call for price';
    const title = carTitle(doc as unknown as { year: number; make: string; model: string; variant?: string });
    console.log(`  cars/${doc.id}  ${String(doc.stockNo)}  ${title}  ${price}  ${String(doc.status)}${doc.published ? ' published' : ''}  ${images.length} photos (${images[0]?.id ?? '-'})  slug=${String(doc.slug)}  → ${verb(action)}`);
    if (args.write && action !== 'skip') {
      const ref = db.doc(`cars/${doc.id}`);
      if (action === 'create') await ref.create(docData(doc));
      else await ref.set(docData(doc), { merge: false });
    }
  }

  console.log('\nSettings');
  for (const { id, action } of settingsPlan) {
    const extra = id === 'app' ? `  (nextStockNo=${String(settings.app.nextStockNo)})` : id === 'business' ? `  (${String(settings.business.name)}, ${String(settings.business.phone)})` : '';
    console.log(`  settings/${id}${extra}  → ${verb(action)}`);
    if (args.write && action !== 'skip') {
      const ref = db.doc(`settings/${id}`);
      const data = docData({ id, ...settings[id] });
      if (action === 'create') await ref.create(data);
      else await ref.set(data, { merge: false });
    }
  }

  const n = (list: { action: string }[], a: string) => list.filter((p) => p.action === a).length;
  const summary = `cars: ${n(carPlan, 'create')} create, ${n(carPlan, 'overwrite')} overwrite, ${n(carPlan, 'skip')} skip; settings: ${n(settingsPlan, 'create')} create, ${n(settingsPlan, 'overwrite')} overwrite, ${n(settingsPlan, 'skip')} skip`;
  console.log(`\n${args.write ? 'Done' : 'Dry run – nothing written'}. ${summary}.`);
  if (!args.write) console.log('Re-run with --write to apply.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`\nseed:stock failed: ${err instanceof Error ? err.message : String(err)}`);
    if (!(err instanceof UsageError) && err instanceof Error && err.stack && process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });
