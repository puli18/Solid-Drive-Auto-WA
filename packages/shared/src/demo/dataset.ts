/**
 * buildDemoDataset() – the bundled dataset: the two demo users and the default settings, as plain objects
 * with JS `Date`s. It holds NO cars: the stock lives in Firestore (seeded with `pnpm seed:stock` from
 * scripts/data/stock.ts). Every other collection (cars, financials, vendors, expenses, sales, deposits,
 * bookings, slot locks/counts, enquiries, audit log) starts empty.
 *
 *  - scripts/seed.ts converts Dates → Firestore Timestamps and writes it to the emulators (plus the stock).
 *  - apps/web/lib/data (demo adapter) serves it directly when VITE_DEMO_MODE=true; demo-mode cars are read
 *    from the live Firestore project when a real Firebase config is given (see apps/web/lib/data/mode.ts).
 *
 * Deterministic: the same `now` always produces the same data (dates are relative to `now`).
 */
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_DEPOSIT_AMOUNT_CENTS,
  DEFAULT_DEPOSIT_TERMS_TEXT,
  DEFAULT_FINANCE_DISCLAIMER,
  DEFAULT_FINANCE_RATE_PCT,
  DEFAULT_LEGAL_SETTINGS,
  DEPOSIT_TERMS_VERSION,
  type Role,
} from '../constants';
import { addDaysToDateKey, todayInTz, zonedToUtc } from '../time';
import { DEMO_ACCOUNTS } from './fixtures';

/** A stored document with Firestore Timestamps replaced by Date. */
export type DemoDoc = { id: string } & Record<string, unknown>;

export interface DemoDataset {
  users: DemoDoc[];
  settings: Record<'business' | 'booking' | 'deposit' | 'finance' | 'legal' | 'app', Record<string, unknown>>;
  vendors: DemoDoc[];
  cars: DemoDoc[];
  carFinancials: DemoDoc[];
  /** All expenses (each has `carId`; stored at cars/{carId}/expenses/{id}). */
  expenses: DemoDoc[];
  sales: DemoDoc[];
  deposits: DemoDoc[];
  bookings: DemoDoc[];
  slotLocks: DemoDoc[];
  slotCounts: DemoDoc[];
  enquiries: DemoDoc[];
  auditLog: DemoDoc[];
}

export interface BuildDemoOptions {
  now?: Date;
  /** Override user ids (seed uses the fixed demo ids too). */
  uids?: Partial<Record<Role, string>>;
}

const SEED = 'seed';

export type SettingsDocs = DemoDataset['settings'];

/**
 * The six `settings/*` docs built from the shared defaults, each with the given meta fields. Used by the
 * demo dataset and by `scripts/seed-stock.ts` (first-time settings for a real project).
 * nextStockNo stays at the default unless overridden: the admin takes max(existing SDA number + 1, nextStockNo).
 */
export function defaultSettingsDocs(meta: Record<string, unknown>, overrides: { nextStockNo?: number } = {}): SettingsDocs {
  return {
    business: { ...DEFAULT_BUSINESS_SETTINGS, address: { ...DEFAULT_BUSINESS_SETTINGS.address }, ...meta },
    booking: { ...structuredClone(DEFAULT_BOOKING_SETTINGS), ...meta },
    deposit: {
      amountCents: DEFAULT_DEPOSIT_AMOUNT_CENTS,
      termsText: DEFAULT_DEPOSIT_TERMS_TEXT,
      termsVersion: DEPOSIT_TERMS_VERSION,
      enabled: true,
      ...meta,
    },
    finance: { indicativeRatePct: DEFAULT_FINANCE_RATE_PCT, disclaimer: DEFAULT_FINANCE_DISCLAIMER, ...meta },
    legal: { ...DEFAULT_LEGAL_SETTINGS, ...meta },
    app: { ...DEFAULT_APP_SETTINGS, ...(overrides.nextStockNo ? { nextStockNo: overrides.nextStockNo } : {}), ...meta },
  };
}

export function buildDemoDataset(opts: BuildDemoOptions = {}): DemoDataset {
  const now = opts.now ?? new Date();
  const TZ = DEFAULT_BUSINESS_SETTINGS.timezone;
  const uids = { admin: opts.uids?.admin ?? DEMO_ACCOUNTS.admin.uid, staff: opts.uids?.staff ?? DEMO_ACCOUNTS.staff.uid };
  const today = todayInTz(TZ, now);
  const daysAgo = (n: number, hour = 10) =>
    zonedToUtc(addDaysToDateKey(today, -n), `${String(hour).padStart(2, '0')}:00`, TZ);
  const audit = (at: Date, by = SEED) => ({ createdAt: at, createdBy: by, updatedAt: at, updatedBy: by, deletedAt: null });

  const ds: DemoDataset = {
    users: [],
    settings: {} as DemoDataset['settings'],
    vendors: [],
    cars: [],
    carFinancials: [],
    expenses: [],
    sales: [],
    deposits: [],
    bookings: [],
    slotLocks: [],
    slotCounts: [],
    enquiries: [],
    auditLog: [],
  };

  // ---- users ----
  for (const role of ['admin', 'staff'] as const) {
    const a = DEMO_ACCOUNTS[role];
    ds.users.push({
      id: uids[role],
      name: a.name,
      email: a.email,
      role,
      active: true,
      lastLoginAt: null,
      invitedAt: daysAgo(120),
      ...audit(daysAgo(120)),
    });
  }

  // ---- settings ----
  ds.settings = defaultSettingsDocs({ updatedAt: daysAgo(30), updatedBy: SEED });

  return ds;
}
