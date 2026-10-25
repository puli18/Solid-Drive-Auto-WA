/** Demo adapter for the admin surface: fixtures + localStorage overlay (this browser only). */
import { carInputSchema, carFinancialsInputSchema, expenseInputSchema, saleInputSchema, vendorInputSchema } from '@sda/shared';
import type { DemoDoc } from '@sda/shared/demo';
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
import { demoGet, demoGetSettings, demoList, demoNewId, demoPut, demoPutSettings, type DemoCollection } from './store';

const created = (uid: string) => {
  const now = new Date();
  return { createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid, deletedAt: null };
};
const updated = (uid: string) => ({ updatedAt: new Date(), updatedBy: uid });

function patchDoc(col: DemoCollection, id: string, patch: Record<string, unknown>, uid: string): DemoDoc {
  const cur = demoGet(col, id);
  if (!cur) throw new Error(`Not found: ${col}/${id}`);
  const next = { ...cur, ...patch, ...updated(uid) };
  demoPut(col, next);
  return next;
}

function audit(uid: string, action: string, entity: string, entityId: string, carId: string | null, before: unknown, after: unknown) {
  const id = demoNewId('audit');
  demoPut('auditLog', { id, actorUid: uid, action, entity, entityId, carId, before: before ?? null, after: after ?? null, at: new Date() });
}

const as = <T>(rows: unknown) => rows as T;

export const demoAdminRepo: AdminRepository = {
  mode: 'demo',

  async listCars(opts) {
    const rows = demoList('cars').filter((c) => opts?.includeDeleted || !c.deletedAt);
    return as<CarRecord[]>(sortNewestFirst(rows));
  },
  async getCar(id) {
    return as<CarRecord | null>(demoGet('cars', id));
  },
  async createCar(input, uid) {
    const car = carInputSchema.parse(input);
    const id = demoNewId('car');
    demoPut('cars', { id, ...datesFromKeys(car), ...derivedCarFields(car), soldAt: null, reservedAt: null, ...created(uid) });
    audit(uid, 'create', 'car', id, id, null, { stockNo: car.stockNo, status: car.status });
    return id;
  },
  async updateCar(id, patch, uid) {
    const before = demoGet('cars', id);
    if (!before) throw new Error('Car not found');
    const merged = { ...before, ...datesFromKeys(patch as Record<string, unknown>) } as unknown as Parameters<typeof derivedCarFields>[0];
    const next = patchDoc('cars', id, { ...datesFromKeys(patch as Record<string, unknown>), ...derivedCarFields(merged) }, uid);
    const action = before.status !== next.status ? 'status-change' : 'update';
    audit(uid, action, 'car', id, id, { status: before.status, priceCents: before.priceCents }, { status: next.status, priceCents: next.priceCents });
  },
  async softDeleteCar(id, uid) {
    patchDoc('cars', id, { deletedAt: new Date(), deletedBy: uid, published: false }, uid);
    audit(uid, 'delete', 'car', id, id, null, null);
  },
  async restoreCar(id, uid) {
    patchDoc('cars', id, { deletedAt: null, deletedBy: null }, uid);
    audit(uid, 'restore', 'car', id, id, null, null);
  },

  async getCarFinancials(carId) {
    return as<CarFinancialsRecord | null>(demoGet('carFinancials', carId));
  },
  async saveCarFinancials(carId, input, uid) {
    const data = datesFromKeys(carFinancialsInputSchema.parse(input));
    const cur = demoGet('carFinancials', carId);
    demoPut('carFinancials', cur ? { ...cur, ...data, ...updated(uid) } : { id: carId, ...data, ...created(uid) });
  },

  async listExpenses(carId) {
    const rows = demoList('expenses').filter((e) => !e.deletedAt && (!carId || e.carId === carId));
    return as<ExpenseRecord[]>(rows.sort((a, b) => +(b.date as Date) - +(a.date as Date)));
  },
  async createExpense(carId, input, uid) {
    const data = datesFromKeys(expenseInputSchema.parse(input));
    const id = demoNewId('exp');
    demoPut('expenses', { id, carId, ...data, loggedBy: uid, ...created(uid) });
    audit(uid, 'create', 'expense', id, carId, null, { totalCents: data.totalCents });
    return id;
  },
  async updateExpense(_carId, id, patch, uid) {
    patchDoc('expenses', id, datesFromKeys(patch as Record<string, unknown>), uid);
  },
  async softDeleteExpense(carId, id, uid) {
    patchDoc('expenses', id, { deletedAt: new Date(), deletedBy: uid }, uid);
    audit(uid, 'delete', 'expense', id, carId, null, null);
  },

  async listVendors() {
    return as<VendorRecord[]>(demoList('vendors').filter((v) => !v.deletedAt).sort((a, b) => String(a.name).localeCompare(String(b.name))));
  },
  async createVendor(input, uid) {
    const id = demoNewId('vendor');
    demoPut('vendors', { id, ...vendorInputSchema.parse(input), ...created(uid) });
    return id;
  },
  async updateVendor(id, patch, uid) {
    patchDoc('vendors', id, patch as Record<string, unknown>, uid);
  },

  async listSales() {
    return as<SaleRecord[]>(demoList('sales').filter((s) => !s.deletedAt).sort((a, b) => +(b.saleDate as Date) - +(a.saleDate as Date)));
  },
  async getSale(id) {
    return as<SaleRecord | null>(demoGet('sales', id));
  },
  async createSale(input, uid) {
    const data = datesFromKeys(saleInputSchema.parse(input));
    const id = demoNewId('sale');
    demoPut('sales', { id, ...data, ...created(uid) });
    audit(uid, 'create', 'sale', id, data.carId, null, { salePriceCents: data.salePriceCents });
    return id;
  },
  async updateSale(id, patch, uid) {
    patchDoc('sales', id, datesFromKeys(patch as Record<string, unknown>), uid);
  },

  async listBookings(range) {
    const rows = demoList('bookings').filter((b) => {
      const t = +(b.startAt as Date);
      return (!range?.from || t >= +range.from) && (!range?.to || t <= +range.to);
    });
    return as<BookingRecord[]>(rows.sort((a, b) => +(a.startAt as Date) - +(b.startAt as Date)));
  },
  async updateBooking(id, patch, uid) {
    patchDoc('bookings', id, { ...patch, ...(patch.status === 'cancelled' ? { cancelledAt: new Date() } : {}) }, uid);
  },

  async listEnquiries() {
    return as<EnquiryRecord[]>(sortNewestFirst(demoList('enquiries')));
  },
  async updateEnquiry(id, patch, uid) {
    patchDoc('enquiries', id, patch, uid);
  },
  async addEnquiryNote(id, text, uid) {
    const cur = demoGet('enquiries', id);
    if (!cur) throw new Error('Enquiry not found');
    const notes = [...((cur.notes as unknown[]) ?? []), { text, by: uid, at: new Date() }];
    patchDoc('enquiries', id, { notes }, uid);
  },

  async listDeposits() {
    return as<DepositRecord[]>(sortNewestFirst(demoList('deposits')));
  },
  async resolveDepositConflict(id, note, uid) {
    patchDoc('deposits', id, { conflictResolvedAt: new Date(), conflictResolvedBy: uid, conflictNote: note }, uid);
  },

  async listUsers() {
    return as<UserRecord[]>(demoList('users'));
  },
  async getUser(uid) {
    return as<UserRecord | null>(demoGet('users', uid));
  },

  async getSettings(id) {
    return withSettingsDefaults(id, demoGetSettings(id));
  },
  async saveSettings(id, data, uid) {
    demoPutSettings(id, { ...(data as Record<string, unknown>), ...updated(uid) });
  },

  async listAuditLog(opts) {
    const rows = demoList('auditLog')
      .filter((a) => !opts?.carId || a.carId === opts.carId)
      .sort((a, b) => +(b.at as Date) - +(a.at as Date));
    return as<AuditLogRecord[]>(rows.slice(0, opts?.limit ?? 200));
  },
};
