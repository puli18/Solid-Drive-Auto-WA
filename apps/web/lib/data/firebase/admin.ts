/** Firebase adapter for the admin surface (client SDK; Firestore rules apply). */
import {
  carFinancialsInputSchema,
  carInputSchema,
  COLLECTIONS,
  expenseInputSchema,
  saleInputSchema,
  vendorInputSchema,
} from '@sda/shared';
import {
  addDoc,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDb } from '../../firebase-db';
import { createFields, restoreFields, softDeleteFields, updateFields } from '../../firebase-writes';
import { datesFromKeys, derivedCarFields, sortNewestFirst, withSettingsDefaults } from '../common';
import type {
  AdminRepository,
  AuditLogRecord,
  BookingRecord,
  CarFinancialsRecord,
  CarRecord,
  DepositRecord,
  EnquiryRecord,
  ExpenseRecord,
  SaleRecord,
  UserRecord,
  VendorRecord,
} from '../types';

/** Timestamp → Date, recursively. */
export function fromFirestore<T>(value: unknown): T {
  if (value instanceof Timestamp) return value.toDate() as T;
  if (Array.isArray(value)) return value.map((v) => fromFirestore(v)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromFirestore(v)])) as T;
  }
  return value as T;
}

async function list<T>(path: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const snap = await getDocs(query(collection(getDb(), path), ...constraints));
  return snap.docs.map((d) => fromFirestore<T>({ id: d.id, ...d.data() }));
}
async function get<T>(path: string): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), path));
  return snap.exists() ? fromFirestore<T>({ id: snap.id, ...snap.data() }) : null;
}
const patch = (path: string, data: Record<string, unknown>) => updateDoc(doc(getDb(), path), data);

export const firebaseAdminRepo: AdminRepository = {
  mode: 'firebase',

  async listCars(opts) {
    const rows = await list<CarRecord>(COLLECTIONS.cars);
    return sortNewestFirst(rows.filter((c) => opts?.includeDeleted || !c.deletedAt));
  },
  getCar: (id) => get<CarRecord>(`cars/${id}`),
  async createCar(input, uid) {
    const car = carInputSchema.parse(input);
    const ref = await addDoc(collection(getDb(), COLLECTIONS.cars), {
      ...datesFromKeys(car),
      ...derivedCarFields(car),
      soldAt: null,
      reservedAt: null,
      ...createFields(uid),
    });
    return ref.id;
  },
  async updateCar(id, p, uid) {
    const cur = await get<CarRecord>(`cars/${id}`);
    if (!cur) throw new Error('Car not found');
    const data = datesFromKeys(p as Record<string, unknown>);
    await patch(`cars/${id}`, { ...data, ...derivedCarFields({ ...cur, ...data } as CarRecord), ...updateFields(uid) });
  },
  softDeleteCar: (id, uid) => patch(`cars/${id}`, { ...softDeleteFields(uid), published: false }),
  restoreCar: (id, uid) => patch(`cars/${id}`, restoreFields(uid)),

  getCarFinancials: (carId) => get<CarFinancialsRecord>(`carFinancials/${carId}`),
  async saveCarFinancials(carId, input, uid) {
    const data = datesFromKeys(carFinancialsInputSchema.parse(input));
    const ref = doc(getDb(), `carFinancials/${carId}`);
    const exists = (await getDoc(ref)).exists();
    if (exists) await updateDoc(ref, { ...data, ...updateFields(uid) });
    else await setDoc(ref, { ...data, ...createFields(uid) });
  },

  async listExpenses(carId) {
    const rows = carId
      ? await list<ExpenseRecord>(`cars/${carId}/expenses`)
      : (await getDocs(query(collectionGroup(getDb(), COLLECTIONS.expenses)))).docs.map((d) =>
          fromFirestore<ExpenseRecord>({ id: d.id, ...d.data() }),
        );
    return rows.filter((e) => !e.deletedAt).sort((a, b) => +b.date - +a.date);
  },
  async createExpense(carId, input, uid) {
    const data = datesFromKeys(expenseInputSchema.parse(input));
    const ref = await addDoc(collection(getDb(), `cars/${carId}/expenses`), { ...data, carId, loggedBy: uid, ...createFields(uid) });
    return ref.id;
  },
  updateExpense: (carId, id, p, uid) => patch(`cars/${carId}/expenses/${id}`, { ...datesFromKeys(p as Record<string, unknown>), ...updateFields(uid) }),
  softDeleteExpense: (carId, id, uid) => patch(`cars/${carId}/expenses/${id}`, softDeleteFields(uid)),

  async listVendors() {
    return (await list<VendorRecord>(COLLECTIONS.vendors)).filter((v) => !v.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  },
  async createVendor(input, uid) {
    const ref = await addDoc(collection(getDb(), COLLECTIONS.vendors), { ...vendorInputSchema.parse(input), ...createFields(uid) });
    return ref.id;
  },
  updateVendor: (id, p, uid) => patch(`vendors/${id}`, { ...p, ...updateFields(uid) }),

  async listSales() {
    return (await list<SaleRecord>(COLLECTIONS.sales, orderBy('saleDate', 'desc'))).filter((s) => !s.deletedAt);
  },
  getSale: (id) => get<SaleRecord>(`sales/${id}`),
  async createSale(input, uid) {
    const data = datesFromKeys(saleInputSchema.parse(input));
    const ref = await addDoc(collection(getDb(), COLLECTIONS.sales), { ...data, ...createFields(uid) });
    return ref.id;
  },
  updateSale: (id, p, uid) => patch(`sales/${id}`, { ...datesFromKeys(p as Record<string, unknown>), ...updateFields(uid) }),

  listBookings(range) {
    const c: QueryConstraint[] = [];
    if (range?.from) c.push(where('startAt', '>=', Timestamp.fromDate(range.from)));
    if (range?.to) c.push(where('startAt', '<=', Timestamp.fromDate(range.to)));
    return list<BookingRecord>(COLLECTIONS.bookings, ...c, orderBy('startAt', 'asc'));
  },
  updateBooking: (id, p, uid) => patch(`bookings/${id}`, { ...p, ...updateFields(uid) }),

  async listEnquiries() {
    return sortNewestFirst(await list<EnquiryRecord>(COLLECTIONS.enquiries));
  },
  updateEnquiry: (id, p, uid) => patch(`enquiries/${id}`, { ...p, ...updateFields(uid) }),
  // serverTimestamp() is not allowed inside arrays – note time is client time.
  addEnquiryNote: (id, text, uid) =>
    patch(`enquiries/${id}`, { notes: arrayUnion({ text, by: uid, at: Timestamp.now() }), ...updateFields(uid) }),

  async listDeposits() {
    return sortNewestFirst(await list<DepositRecord>(COLLECTIONS.deposits));
  },
  resolveDepositConflict: (id, note, uid) =>
    patch(`deposits/${id}`, { conflictResolvedAt: serverTimestamp(), conflictResolvedBy: uid, conflictNote: note, ...updateFields(uid) }),

  listUsers: () => list<UserRecord>(COLLECTIONS.users),
  getUser: (uid) => get<UserRecord>(`users/${uid}`),

  async getSettings(id) {
    return withSettingsDefaults(id, await get<Record<string, unknown>>(`settings/${id}`));
  },
  saveSettings: (id, data, uid) => setDoc(doc(getDb(), `settings/${id}`), { ...(data as Record<string, unknown>), ...updateFields(uid) }),

  listAuditLog(opts) {
    const c: QueryConstraint[] = [];
    if (opts?.carId) c.push(where('carId', '==', opts.carId));
    c.push(orderBy('at', 'desc'), qLimit(opts?.limit ?? 200));
    return list<AuditLogRecord>(COLLECTIONS.auditLog, ...c);
  },
};
