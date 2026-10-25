/**
 * `pnpm seed` – resets and seeds the LOCAL Emulator Suite (project demo-solid-drive) with the shared
 * demo dataset (`buildDemoDataset()` in @sda/shared/demo – the same data the demo-mode preview shows).
 * Refuses to run against anything that isn't a demo- project.
 *
 * Flags: --no-reset  keep existing emulator data (documents are overwritten by id).
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type WriteBatch } from 'firebase-admin/firestore';
import { EMULATOR_HOST, EMULATOR_PORTS } from '@sda/shared';
import { buildDemoDataset, type DemoDoc } from '@sda/shared/demo';
import { seedConfig } from './seed.config';

const PROJECT_ID = seedConfig.projectId;
process.env.FIRESTORE_EMULATOR_HOST ??= `${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`;
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${EMULATOR_HOST}:${EMULATOR_PORTS.storage}`;

if (!PROJECT_ID.startsWith('demo-')) throw new Error(`Refusing to seed non-demo project "${PROJECT_ID}"`);

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth(app);

/** Recursively convert Date → Timestamp. */
function toFirestore(value: unknown): unknown {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(toFirestore);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toFirestore(v)]));
  }
  return value;
}

async function resetEmulators() {
  const fsUrl = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  for (const url of [fsUrl, authUrl]) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Reset failed (${res.status}) for ${url}`);
  }
}

async function seedAuthUsers() {
  for (const role of ['admin', 'staff'] as const) {
    const u = seedConfig.users[role];
    const existing = await auth.getUser(u.uid).catch(() => null);
    if (!existing) {
      await auth.createUser({ uid: u.uid, email: u.email, password: u.password, displayName: u.name, emailVerified: true });
    }
    await auth.setCustomUserClaims(u.uid, { role });
  }
}

async function writeAll(path: (d: DemoDoc) => string, docs: DemoDoc[]) {
  let batch: WriteBatch = db.batch();
  let ops = 0;
  for (const d of docs) {
    const { id: _id, ...data } = d;
    batch.set(db.doc(path(d)), toFirestore(data) as Record<string, unknown>);
    if (++ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();
}

async function main() {
  const reset = !process.argv.includes('--no-reset');
  console.log(`Seeding ${PROJECT_ID} via Firestore ${process.env.FIRESTORE_EMULATOR_HOST}, Auth ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  try {
    if (reset) await resetEmulators();
  } catch (err) {
    console.error('\nCould not reach the emulators. Start them first with `pnpm emulators`.\n');
    throw err;
  }
  const ds = buildDemoDataset();
  await seedAuthUsers();
  for (const [id, data] of Object.entries(ds.settings)) await db.doc(`settings/${id}`).set(toFirestore(data) as Record<string, unknown>);
  for (const col of ['users', 'vendors', 'cars', 'carFinancials', 'sales', 'deposits', 'bookings', 'slotLocks', 'slotCounts', 'enquiries', 'auditLog'] as const) {
    await writeAll((d) => `${col}/${d.id}`, ds[col]);
  }
  await writeAll((d) => `cars/${String(d.carId)}/expenses/${d.id}`, ds.expenses);

  const counts = await Promise.all(
    ['cars', 'carFinancials', 'vendors', 'bookings', 'enquiries', 'sales', 'deposits'].map(
      async (c) => `${c}=${(await db.collection(c).count().get()).data().count}`,
    ),
  );
  const expenses = (await db.collectionGroup('expenses').count().get()).data().count;
  console.log(`✔ Seeded: ${counts.join(', ')}, expenses=${expenses}`);
  console.log(`  Admin: ${seedConfig.users.admin.email}   Staff: ${seedConfig.users.staff.email}   (passwords in @sda/shared/demo DEMO_ACCOUNTS)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
