/**
 * Types returned by the repository layer. Stored docs come back with Firestore Timestamps replaced by
 * JS `Date` (both adapters), plus `id`.
 */
import type {
  AppSettings,
  AuditLogEntry,
  Booking,
  BookingSettings,
  BookingStaffUpdate,
  BusinessSettings,
  Car,
  CarFinancials,
  CarFinancialsFormValues,
  CarFormValues,
  Deposit,
  DepositSettings,
  Enquiry,
  EnquiryStatus,
  Expense,
  ExpenseFormValues,
  FinanceSettings,
  LegalSettings,
  Sale,
  SaleFormValues,
  TimestampLike,
  UserDoc,
  Vendor,
  VendorFormValues,
} from '@sda/shared';

/** Replace Timestamp/Date fields with Date, recursively. */
export type Dated<T> = T extends TimestampLike | Date
  ? Date
  : T extends (infer U)[]
    ? Dated<U>[]
    : T extends object
      ? { [K in keyof T]: Dated<T[K]> }
      : T;

export type Rec<T> = Dated<T> & { id: string };

export type CarRecord = Rec<Car>;
export type CarFinancialsRecord = Rec<CarFinancials>;
export type ExpenseRecord = Rec<Expense>;
export type VendorRecord = Rec<Vendor>;
export type SaleRecord = Rec<Sale>;
export type BookingRecord = Rec<Booking>;
export type DepositRecord = Rec<Deposit>;
export type EnquiryRecord = Rec<Enquiry>;
export type UserRecord = Rec<UserDoc>;
export type AuditLogRecord = Rec<AuditLogEntry>;

export interface SettingsMap {
  business: BusinessSettings;
  booking: BookingSettings;
  deposit: DepositSettings;
  finance: FinanceSettings;
  legal: LegalSettings;
  app: AppSettings;
}
export type SettingsId = keyof SettingsMap;

/** Public settings bundle used by the public site (all docs merged over PLACEHOLDER defaults). */
export type PublicSettings = Omit<SettingsMap, 'app'>;

/**
 * Admin / staff read-write surface (client-side). Get it with `getAdminRepo()` from '@/lib/data'.
 * Inputs are the shared zod *form values* (date-only fields as "YYYY-MM-DD" strings) – validate with the
 * matching schema first. Every write takes the acting user's uid for the audit fields.
 * Rules still apply in Firebase mode: staff calls to financials/deposits/users/settings(write) fail.
 */
export interface AdminRepository {
  readonly mode: 'firebase' | 'demo';

  // Cars
  listCars(opts?: { includeDeleted?: boolean }): Promise<CarRecord[]>;
  getCar(id: string): Promise<CarRecord | null>;
  /** Generates slug + searchText. Returns the new car id. */
  createCar(input: CarFormValues, uid: string): Promise<string>;
  /** Partial update; slug is regenerated when year/make/model/variant/stockNo change. */
  updateCar(id: string, patch: Partial<CarFormValues> & { soldAt?: Date | null; reservedAt?: Date | null }, uid: string): Promise<void>;
  softDeleteCar(id: string, uid: string): Promise<void>;
  restoreCar(id: string, uid: string): Promise<void>;

  // Financials (admin only)
  getCarFinancials(carId: string): Promise<CarFinancialsRecord | null>;
  saveCarFinancials(carId: string, input: CarFinancialsFormValues, uid: string): Promise<void>;

  // Expenses (staff: list + create; admin: update + soft delete)
  /** Omit carId to list every car's expenses (collection group). */
  listExpenses(carId?: string): Promise<ExpenseRecord[]>;
  createExpense(carId: string, input: ExpenseFormValues, uid: string): Promise<string>;
  updateExpense(carId: string, id: string, patch: Partial<ExpenseFormValues>, uid: string): Promise<void>;
  softDeleteExpense(carId: string, id: string, uid: string): Promise<void>;

  // Vendors
  listVendors(): Promise<VendorRecord[]>;
  createVendor(input: VendorFormValues, uid: string): Promise<string>;
  updateVendor(id: string, patch: Partial<VendorFormValues>, uid: string): Promise<void>;

  // Sales (staff: list + create; admin: update)
  listSales(): Promise<SaleRecord[]>;
  getSale(id: string): Promise<SaleRecord | null>;
  createSale(input: SaleFormValues, uid: string): Promise<string>;
  updateSale(id: string, patch: Partial<SaleFormValues>, uid: string): Promise<void>;

  // Bookings (created via callables; dashboard edits status/notes only)
  listBookings(range?: { from?: Date; to?: Date }): Promise<BookingRecord[]>;
  updateBooking(id: string, patch: BookingStaffUpdate, uid: string): Promise<void>;

  // Enquiries (created via callables)
  listEnquiries(): Promise<EnquiryRecord[]>;
  updateEnquiry(id: string, patch: { status?: EnquiryStatus; assignedTo?: string | null; bookingId?: string | null }, uid: string): Promise<void>;
  addEnquiryNote(id: string, text: string, uid: string): Promise<void>;

  // Deposits (admin)
  listDeposits(): Promise<DepositRecord[]>;
  resolveDepositConflict(id: string, note: string, uid: string): Promise<void>;

  // Users (admin; staff may read only their own)
  listUsers(): Promise<UserRecord[]>;
  getUser(uid: string): Promise<UserRecord | null>;

  // Settings (admin writes)
  getSettings<K extends SettingsId>(id: K): Promise<SettingsMap[K]>;
  saveSettings<K extends SettingsId>(id: K, data: SettingsMap[K], uid: string): Promise<void>;

  // Audit log (admin)
  listAuditLog(opts?: { carId?: string; limit?: number }): Promise<AuditLogRecord[]>;
}
