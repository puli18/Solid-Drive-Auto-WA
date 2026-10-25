import { addDaysToDateKey, COLLECTIONS, DEFAULT_BOOKING_SETTINGS, todayInTz, weekdayOfDateKey } from '@sda/shared';
import { db, Timestamp } from '../../src/core/admin';

export const PROJECT = 'demo-solid-drive';
export const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export async function resetFirestore() {
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Firestore reset failed: ${res.status}`);
}

export async function resetAuth() {
  const url = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`;
  await fetch(url, { method: 'DELETE' });
}

export async function seedSettings(booking: Partial<typeof DEFAULT_BOOKING_SETTINGS> & Record<string, unknown> = {}) {
  await db.doc('settings/booking').set({ ...structuredClone(DEFAULT_BOOKING_SETTINGS), ...booking });
  await db.doc('settings/business').set({ name: 'Solid Drive Auto WA', timezone: 'Australia/Perth', email: 'sales@soliddrive.test', phone: '(08) 9000 0000', gstRate: 10 });
  await db.doc('settings/deposit').set({ amountCents: 50_000, termsText: 'Non-refundable.', termsVersion: 'v-test', enabled: true });
}

export async function seedCar(id: string, extra: Record<string, unknown> = {}) {
  const now = Timestamp.now();
  await db.collection(COLLECTIONS.cars).doc(id).set({
    stockNo: `SDA${id.replace(/\D/g, '').padStart(4, '1')}`,
    slug: `2021-toyota-hilux-sr5-${id}`,
    make: 'Toyota',
    model: 'Hilux',
    variant: 'SR5',
    year: 2021,
    km: 50_000,
    priceCents: 4_999_000,
    status: 'available',
    published: true,
    images: [],
    syndication: { carsales: true, gumtree: false, facebook: false },
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
    deletedAt: null,
    ...extra,
  });
}

/** Next open weekday (Mon–Fri) at least 2 days out. */
export function nextWeekday(now = new Date()): string {
  let d = addDaysToDateKey(todayInTz('Australia/Perth', now), 2);
  while (['sat', 'sun'].includes(weekdayOfDateKey(d))) d = addDaysToDateKey(d, 1);
  return d;
}

export const callReq = (data: unknown, auth?: { uid: string; role?: 'admin' | 'staff' }) =>
  ({
    data,
    auth: auth ? { uid: auth.uid, token: { role: auth.role, email: `${auth.uid}@test` } } : undefined,
    rawRequest: { ip: '127.0.0.1', headers: {} },
  }) as never;

export async function count(col: string) {
  return (await db.collection(col).count().get()).data().count;
}
