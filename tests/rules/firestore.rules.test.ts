/**
 * Firestore rules – anonymous, signed-in-without-role, staff and admin for every collection,
 * per the permission matrix in "Dealership Platform – Build Plan.md".
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ADMIN_UID, actors, type Actors, createEnv, STAFF_UID } from './setup';

let env: RulesTestEnvironment;
let a: Actors;
const fs = (ctx: { firestore(): unknown }) => ctx.firestore() as Firestore;

const past = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const stored = { createdAt: past, createdBy: 'seed', updatedAt: past, updatedBy: 'seed', deletedAt: null };
const created = (uid: string) => ({
  createdAt: serverTimestamp(),
  createdBy: uid,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  deletedAt: null,
});
const updated = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });

const carData = (over: Record<string, unknown> = {}) => ({
  stockNo: 'SDA1001',
  slug: '2021-toyota-hilux-sr5-sda1001',
  make: 'Toyota',
  model: 'Hilux',
  variant: 'SR5',
  year: 2021,
  bodyType: 'ute',
  transmission: 'automatic',
  fuel: 'diesel',
  km: 45000,
  priceCents: 4599000,
  status: 'available',
  published: true,
  images: [],
  features: [],
  description: '',
  ...over,
});
const expenseData = (carId: string, uid: string) => ({
  carId,
  date: past,
  category: 'tyres',
  description: '4 tyres',
  amountExGstCents: 80000,
  gstCents: 8000,
  totalCents: 88000,
  loggedBy: uid,
});

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  a = actors(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = fs(ctx);
    await setDoc(doc(db, 'cars/pub'), { ...carData(), ...stored });
    await setDoc(doc(db, 'cars/draft'), { ...carData({ stockNo: 'SDA1002', status: 'draft', published: false }), ...stored });
    await setDoc(doc(db, 'cars/pub/expenses/e1'), { ...expenseData('pub', STAFF_UID), ...stored });
    await setDoc(doc(db, 'carFinancials/pub'), { purchasePriceCents: 3000000, purchaseGstCents: 0, source: 'auction', purchaseDate: past, ...stored });
    await setDoc(doc(db, 'sales/s1'), { carId: 'pub', stockNo: 'SDA1001', salePriceCents: 4000000, saleGstCents: 400000, ...stored });
    await setDoc(doc(db, 'bookings/b1'), {
      carId: 'pub', type: 'inspection', status: 'confirmed', startAt: past, endAt: past, notes: '',
      customer: { name: 'Jo', phone: '0400000000', email: 'jo@example.com' }, manageToken: 'hash', source: 'web', licenceConfirmed: false, ...stored,
    });
    await setDoc(doc(db, 'slotLocks/pub_20260101_0900'), { bookingId: 'b1' });
    await setDoc(doc(db, 'slotCounts/20260101_0900'), { count: 1 });
    await setDoc(doc(db, 'deposits/d1'), { carId: 'pub', amountCents: 50000, status: 'conflict', ...stored });
    await setDoc(doc(db, 'enquiries/q1'), { type: 'general', status: 'new', message: 'Hi', notes: [], customer: { name: 'Jo', phone: '0400000000', email: 'jo@example.com' }, ...stored });
    await setDoc(doc(db, 'vendors/v1'), { name: 'Tyre Co', ...stored });
    await setDoc(doc(db, `users/${STAFF_UID}`), { name: 'Staff', email: 'staff@soliddrive.test', role: 'staff', active: true, ...stored });
    await setDoc(doc(db, `users/${ADMIN_UID}`), { name: 'Admin', email: 'admin@soliddrive.test', role: 'admin', active: true, ...stored });
    for (const id of ['business', 'booking', 'deposit', 'finance', 'legal', 'app', 'internal']) {
      await setDoc(doc(db, `settings/${id}`), { value: id, updatedAt: past, updatedBy: 'seed' });
    }
    await setDoc(doc(db, 'auditLog/l1'), { actorUid: 'x', action: 'create', entity: 'car', entityId: 'pub', at: past, before: null, after: null });
    await setDoc(doc(db, 'secretStuff/x'), { a: 1 });
  });
});

describe('cars', () => {
  it('anonymous: reads published cars only, never writes', async () => {
    await assertSucceeds(getDoc(doc(fs(a.anon), 'cars/pub')));
    await assertFails(getDoc(doc(fs(a.anon), 'cars/draft')));
    await assertSucceeds(getDocs(query(collection(fs(a.anon), 'cars'), where('published', '==', true))));
    await assertFails(getDocs(collection(fs(a.anon), 'cars')));
    await assertFails(setDoc(doc(fs(a.anon), 'cars/new'), { ...carData(), ...created('anon') }));
    await assertFails(updateDoc(doc(fs(a.anon), 'cars/pub'), { priceCents: 1 }));
    await assertFails(deleteDoc(doc(fs(a.anon), 'cars/pub')));
  });
  it('signed in without a role: same as anonymous', async () => {
    await assertFails(getDoc(doc(fs(a.noRole), 'cars/draft')));
    await assertFails(setDoc(doc(fs(a.noRole), 'cars/new'), { ...carData(), ...created('norole-uid') }));
  });
  it('staff: reads all, creates and edits with audit fields, cannot soft- or hard-delete', async () => {
    const db = fs(a.staff);
    await assertSucceeds(getDoc(doc(db, 'cars/draft')));
    await assertSucceeds(getDocs(collection(db, 'cars')));
    await assertSucceeds(setDoc(doc(db, 'cars/new'), { ...carData({ stockNo: 'SDA1003' }), ...created(STAFF_UID) }));
    await assertFails(setDoc(doc(db, 'cars/new2'), carData({ stockNo: 'SDA1004' }))); // no audit fields
    await assertFails(setDoc(doc(db, 'cars/new3'), { ...carData({ status: 'bogus' }), ...created(STAFF_UID) }));
    await assertSucceeds(updateDoc(doc(db, 'cars/pub'), { priceCents: 4499000, published: false, ...updated(STAFF_UID) }));
    await assertFails(updateDoc(doc(db, 'cars/pub'), { priceCents: 1 })); // missing updatedAt/By
    await assertFails(updateDoc(doc(db, 'cars/pub'), { createdBy: STAFF_UID, ...updated(STAFF_UID) }));
    await assertFails(updateDoc(doc(db, 'cars/pub'), { deletedAt: serverTimestamp(), ...updated(STAFF_UID) }));
    await assertFails(deleteDoc(doc(db, 'cars/pub')));
  });
  it('admin: full edit incl. soft delete, never hard delete', async () => {
    const db = fs(a.admin);
    await assertSucceeds(setDoc(doc(db, 'cars/new'), { ...carData(), ...created(ADMIN_UID) }));
    await assertSucceeds(
      updateDoc(doc(db, 'cars/pub'), { deletedAt: serverTimestamp(), deletedBy: ADMIN_UID, published: false, ...updated(ADMIN_UID) }),
    );
    await assertFails(deleteDoc(doc(db, 'cars/pub')));
  });
});

describe('cars/{carId}/expenses', () => {
  const newExpense = (uid: string) => ({ ...expenseData('pub', uid), ...created(uid) });
  it('anonymous / no role: no access', async () => {
    for (const ctx of [a.anon, a.noRole]) {
      await assertFails(getDoc(doc(fs(ctx), 'cars/pub/expenses/e1')));
      await assertFails(setDoc(doc(fs(ctx), 'cars/pub/expenses/x'), newExpense('norole-uid')));
      await assertFails(getDocs(collectionGroup(fs(ctx), 'expenses')));
    }
  });
  it('staff: view and add; cannot edit or delete', async () => {
    const db = fs(a.staff);
    await assertSucceeds(getDoc(doc(db, 'cars/pub/expenses/e1')));
    await assertSucceeds(getDocs(collectionGroup(db, 'expenses')));
    await assertSucceeds(setDoc(doc(db, 'cars/pub/expenses/x'), newExpense(STAFF_UID)));
    await assertFails(setDoc(doc(db, 'cars/pub/expenses/y'), { ...newExpense(STAFF_UID), totalCents: 1 })); // totals must add up
    await assertFails(setDoc(doc(db, 'cars/pub/expenses/z'), { ...newExpense(STAFF_UID), loggedBy: 'someone-else' }));
    await assertFails(updateDoc(doc(db, 'cars/pub/expenses/e1'), { description: 'x', ...updated(STAFF_UID) }));
    await assertFails(updateDoc(doc(db, 'cars/pub/expenses/e1'), { deletedAt: serverTimestamp(), ...updated(STAFF_UID) }));
    await assertFails(deleteDoc(doc(db, 'cars/pub/expenses/e1')));
  });
  it('admin: view, add, edit and soft delete; no hard delete', async () => {
    const db = fs(a.admin);
    await assertSucceeds(getDocs(collectionGroup(db, 'expenses')));
    await assertSucceeds(setDoc(doc(db, 'cars/pub/expenses/x'), newExpense(ADMIN_UID)));
    await assertSucceeds(updateDoc(doc(db, 'cars/pub/expenses/e1'), { description: 'x', ...updated(ADMIN_UID) }));
    await assertSucceeds(updateDoc(doc(db, 'cars/pub/expenses/e1'), { deletedAt: serverTimestamp(), ...updated(ADMIN_UID) }));
    await assertFails(deleteDoc(doc(db, 'cars/pub/expenses/e1')));
  });
});

describe('carFinancials (admin only)', () => {
  it('anonymous, no role and staff are denied', async () => {
    for (const ctx of [a.anon, a.noRole, a.staff]) {
      await assertFails(getDoc(doc(fs(ctx), 'carFinancials/pub')));
      await assertFails(getDocs(collection(fs(ctx), 'carFinancials')));
      await assertFails(setDoc(doc(fs(ctx), 'carFinancials/draft'), { purchasePriceCents: 1, ...created(STAFF_UID) }));
    }
  });
  it('admin reads and writes; no hard delete', async () => {
    const db = fs(a.admin);
    await assertSucceeds(getDoc(doc(db, 'carFinancials/pub')));
    await assertSucceeds(setDoc(doc(db, 'carFinancials/draft'), { purchasePriceCents: 1, ...created(ADMIN_UID) }));
    await assertSucceeds(updateDoc(doc(db, 'carFinancials/pub'), { purchasePriceCents: 2, ...updated(ADMIN_UID) }));
    await assertFails(deleteDoc(doc(db, 'carFinancials/pub')));
  });
});

describe('sales', () => {
  const sale = (uid: string) => ({ carId: 'pub', stockNo: 'SDA1001', salePriceCents: 1, saleGstCents: 0, ...created(uid) });
  it('anonymous / no role: denied', async () => {
    for (const ctx of [a.anon, a.noRole]) {
      await assertFails(getDoc(doc(fs(ctx), 'sales/s1')));
      await assertFails(setDoc(doc(fs(ctx), 'sales/s2'), sale('norole-uid')));
    }
  });
  it('staff: view and create; no edit/delete', async () => {
    const db = fs(a.staff);
    await assertSucceeds(getDoc(doc(db, 'sales/s1')));
    await assertSucceeds(setDoc(doc(db, 'sales/s2'), sale(STAFF_UID)));
    await assertFails(updateDoc(doc(db, 'sales/s1'), { salePriceCents: 1, ...updated(STAFF_UID) }));
    await assertFails(deleteDoc(doc(db, 'sales/s1')));
  });
  it('admin: full (edit + soft delete), no hard delete', async () => {
    const db = fs(a.admin);
    await assertSucceeds(setDoc(doc(db, 'sales/s2'), sale(ADMIN_UID)));
    await assertSucceeds(updateDoc(doc(db, 'sales/s1'), { salePriceCents: 1, ...updated(ADMIN_UID) }));
    await assertSucceeds(updateDoc(doc(db, 'sales/s1'), { deletedAt: serverTimestamp(), ...updated(ADMIN_UID) }));
    await assertFails(deleteDoc(doc(db, 'sales/s1')));
  });
});

describe('bookings (created only by functions)', () => {
  const booking = { carId: 'pub', type: 'inspection', status: 'confirmed', notes: '' };
  it('anonymous / no role: no read, no create', async () => {
    for (const ctx of [a.anon, a.noRole]) {
      await assertFails(getDoc(doc(fs(ctx), 'bookings/b1')));
      await assertFails(setDoc(doc(fs(ctx), 'bookings/b2'), booking));
    }
  });
  for (const who of ['staff', 'admin'] as const) {
    it(`${who}: reads, updates status/notes only, never creates or deletes`, async () => {
      const uid = who === 'staff' ? STAFF_UID : ADMIN_UID;
      const db = fs(a[who]);
      await assertSucceeds(getDoc(doc(db, 'bookings/b1')));
      await assertSucceeds(getDocs(collection(db, 'bookings')));
      await assertFails(setDoc(doc(db, 'bookings/b2'), { ...booking, ...created(uid) }));
      await assertSucceeds(updateDoc(doc(db, 'bookings/b1'), { status: 'attended', notes: 'ok', ...updated(uid) }));
      await assertFails(updateDoc(doc(db, 'bookings/b1'), { status: 'bogus', ...updated(uid) }));
      await assertFails(updateDoc(doc(db, 'bookings/b1'), { startAt: serverTimestamp(), ...updated(uid) }));
      await assertFails(deleteDoc(doc(db, 'bookings/b1')));
    });
  }
});

describe('slotLocks / slotCounts (functions only)', () => {
  it('nobody reads or writes from the client', async () => {
    for (const ctx of [a.anon, a.staff, a.admin]) {
      await assertFails(getDoc(doc(fs(ctx), 'slotLocks/pub_20260101_0900')));
      await assertFails(setDoc(doc(fs(ctx), 'slotLocks/pub_20260101_1000'), { bookingId: 'x' }));
      await assertFails(getDoc(doc(fs(ctx), 'slotCounts/20260101_0900')));
      await assertFails(setDoc(doc(fs(ctx), 'slotCounts/20260101_0900'), { count: 0 }));
    }
  });
});

describe('deposits (admin read; functions write)', () => {
  it('anonymous, no role and staff: denied', async () => {
    for (const ctx of [a.anon, a.noRole, a.staff]) {
      await assertFails(getDoc(doc(fs(ctx), 'deposits/d1')));
      await assertFails(getDocs(collection(fs(ctx), 'deposits')));
      await assertFails(setDoc(doc(fs(ctx), 'deposits/d2'), { carId: 'pub', status: 'paid' }));
    }
  });
  it('admin: reads, marks a conflict resolved, cannot create / change status / delete', async () => {
    const db = fs(a.admin);
    await assertSucceeds(getDoc(doc(db, 'deposits/d1')));
    await assertFails(setDoc(doc(db, 'deposits/d2'), { carId: 'pub', status: 'paid', ...created(ADMIN_UID) }));
    await assertSucceeds(
      updateDoc(doc(db, 'deposits/d1'), {
        conflictResolvedAt: serverTimestamp(),
        conflictResolvedBy: ADMIN_UID,
        conflictNote: 'Refunded in Stripe',
        ...updated(ADMIN_UID),
      }),
    );
    await assertFails(updateDoc(doc(db, 'deposits/d1'), { status: 'paid', ...updated(ADMIN_UID) }));
    await assertFails(deleteDoc(doc(db, 'deposits/d1')));
  });
});

describe('enquiries (created only by functions)', () => {
  const enquiry = { type: 'general', status: 'new', message: 'hello' };
  it('anonymous / no role: cannot create or read', async () => {
    for (const ctx of [a.anon, a.noRole]) {
      await assertFails(setDoc(doc(fs(ctx), 'enquiries/q2'), enquiry));
      await assertFails(getDoc(doc(fs(ctx), 'enquiries/q1')));
    }
  });
  for (const who of ['staff', 'admin'] as const) {
    it(`${who}: reads and works the inbox, cannot create or delete`, async () => {
      const uid = who === 'staff' ? STAFF_UID : ADMIN_UID;
      const db = fs(a[who]);
      await assertSucceeds(getDocs(collection(db, 'enquiries')));
      await assertFails(setDoc(doc(db, 'enquiries/q2'), { ...enquiry, ...created(uid) }));
      await assertSucceeds(updateDoc(doc(db, 'enquiries/q1'), { status: 'contacted', assignedTo: uid, ...updated(uid) }));
      await assertFails(updateDoc(doc(db, 'enquiries/q1'), { message: 'changed', ...updated(uid) }));
      await assertFails(deleteDoc(doc(db, 'enquiries/q1')));
    });
  }
});

describe('vendors', () => {
  it('anonymous / no role: denied', async () => {
    for (const ctx of [a.anon, a.noRole]) {
      await assertFails(getDoc(doc(fs(ctx), 'vendors/v1')));
      await assertFails(setDoc(doc(fs(ctx), 'vendors/v2'), { name: 'X', ...created('norole-uid') }));
    }
  });
  for (const who of ['staff', 'admin'] as const) {
    it(`${who}: reads, creates and edits; no hard delete`, async () => {
      const uid = who === 'staff' ? STAFF_UID : ADMIN_UID;
      const db = fs(a[who]);
      await assertSucceeds(getDocs(collection(db, 'vendors')));
      await assertSucceeds(setDoc(doc(db, 'vendors/v2'), { name: 'Mechanic Co', ...created(uid) }));
      await assertSucceeds(updateDoc(doc(db, 'vendors/v1'), { phone: '0400', ...updated(uid) }));
      await assertFails(deleteDoc(doc(db, 'vendors/v1')));
    });
  }
});

describe('users', () => {
  it('anonymous: denied', async () => {
    await assertFails(getDoc(doc(fs(a.anon), `users/${STAFF_UID}`)));
  });
  it('staff: reads self only, cannot write (no self-promotion)', async () => {
    const db = fs(a.staff);
    await assertSucceeds(getDoc(doc(db, `users/${STAFF_UID}`)));
    await assertFails(getDoc(doc(db, `users/${ADMIN_UID}`)));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(updateDoc(doc(db, `users/${STAFF_UID}`), { role: 'admin' }));
  });
  it('admin: reads all and writes', async () => {
    const db = fs(a.admin);
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, `users/${STAFF_UID}`), { active: false }));
    await assertSucceeds(
      setDoc(doc(db, 'users/new'), { name: 'New', email: 'n@soliddrive.test', role: 'staff', active: true }),
    );
    await assertFails(deleteDoc(doc(db, `users/${STAFF_UID}`)));
  });
});

describe('settings', () => {
  const PUBLIC = ['business', 'booking', 'deposit', 'finance', 'legal'];
  it('anonymous: reads public settings only, never writes', async () => {
    for (const id of PUBLIC) await assertSucceeds(getDoc(doc(fs(a.anon), `settings/${id}`)));
    await assertFails(getDoc(doc(fs(a.anon), 'settings/app')));
    await assertFails(getDoc(doc(fs(a.anon), 'settings/internal')));
    await assertFails(setDoc(doc(fs(a.anon), 'settings/business'), { name: 'x' }));
  });
  it('staff: reads public + app settings, cannot write', async () => {
    const db = fs(a.staff);
    await assertSucceeds(getDoc(doc(db, 'settings/app')));
    await assertFails(getDoc(doc(db, 'settings/internal')));
    await assertFails(updateDoc(doc(db, 'settings/business'), { name: 'x', ...updated(STAFF_UID) }));
  });
  it('admin: reads and writes all settings, no delete', async () => {
    const db = fs(a.admin);
    await assertSucceeds(getDoc(doc(db, 'settings/internal')));
    await assertSucceeds(updateDoc(doc(db, 'settings/deposit'), { amountCents: 60000, ...updated(ADMIN_UID) }));
    await assertFails(updateDoc(doc(db, 'settings/deposit'), { amountCents: 60000 }));
    await assertFails(deleteDoc(doc(db, 'settings/deposit')));
  });
});

describe('auditLog (admin read; functions write)', () => {
  it('only admin reads; nobody writes', async () => {
    await assertFails(getDoc(doc(fs(a.anon), 'auditLog/l1')));
    await assertFails(getDoc(doc(fs(a.staff), 'auditLog/l1')));
    await assertSucceeds(getDoc(doc(fs(a.admin), 'auditLog/l1')));
    await assertSucceeds(getDocs(query(collection(fs(a.admin), 'auditLog'), where('carId', '==', 'pub'))));
    await assertFails(setDoc(doc(fs(a.admin), 'auditLog/l2'), { actorUid: ADMIN_UID }));
    await assertFails(updateDoc(doc(fs(a.admin), 'auditLog/l1'), { actorUid: ADMIN_UID }));
  });
});

describe('unknown collections', () => {
  it('are denied to everyone', async () => {
    for (const ctx of [a.anon, a.staff, a.admin]) {
      await assertFails(getDoc(doc(fs(ctx), 'secretStuff/x')));
      await assertFails(setDoc(doc(fs(ctx), 'secretStuff/y'), { a: 1 }));
    }
  });
});
