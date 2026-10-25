/** Helpers shared by both adapters (no SDK imports). */
import {
  type BookingSettings,
  carSlug,
  DEFAULT_APP_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_DEPOSIT_AMOUNT_CENTS,
  DEFAULT_DEPOSIT_TERMS_TEXT,
  DEFAULT_FINANCE_DISCLAIMER,
  DEFAULT_FINANCE_RATE_PCT,
  DEFAULT_LEGAL_SETTINGS,
  DEFAULT_TIMEZONE,
  DEPOSIT_TERMS_VERSION,
  type PublicCar,
  zonedToUtc,
} from '@sda/shared';
import type { SettingsMap } from './types';

/** Form fields that hold a "YYYY-MM-DD" date and are stored as a Timestamp/Date. */
const DATE_KEY_FIELDS = new Set(['regoExpiry', 'purchaseDate', 'date', 'saleDate', 'deliveryDate']);
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Convert date-key strings in known fields to Dates (midnight in the dealership time zone). */
export function datesFromKeys<T extends Record<string, unknown>>(obj: T, tz: string = DEFAULT_TIMEZONE): T {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (DATE_KEY_FIELDS.has(k) && typeof v === 'string' && DATE_KEY_RE.test(v)) out[k] = zonedToUtc(v, '00:00', tz);
    if (DATE_KEY_FIELDS.has(k) && v === '') out[k] = null;
  }
  return out as T;
}

/** Derived car fields kept in sync on every write. */
export function derivedCarFields(car: {
  year: number;
  make: string;
  model: string;
  variant?: string | null;
  stockNo: string;
  rego?: string | null;
}) {
  return {
    slug: carSlug(car),
    searchText: [car.make, car.model, car.variant, car.stockNo, car.rego].filter(Boolean).join(' ').toLowerCase(),
  };
}

export const SETTINGS_DEFAULTS: SettingsMap = {
  business: { ...DEFAULT_BUSINESS_SETTINGS, address: { ...DEFAULT_BUSINESS_SETTINGS.address } },
  booking: structuredClone(DEFAULT_BOOKING_SETTINGS) as unknown as BookingSettings,
  deposit: {
    amountCents: DEFAULT_DEPOSIT_AMOUNT_CENTS,
    termsText: DEFAULT_DEPOSIT_TERMS_TEXT,
    termsVersion: DEPOSIT_TERMS_VERSION,
    enabled: true,
  },
  finance: { indicativeRatePct: DEFAULT_FINANCE_RATE_PCT, disclaimer: DEFAULT_FINANCE_DISCLAIMER },
  legal: { ...DEFAULT_LEGAL_SETTINGS },
  app: { ...DEFAULT_APP_SETTINGS },
};

/** Merge a stored settings doc over its defaults, dropping meta fields. */
export function withSettingsDefaults<K extends keyof SettingsMap>(id: K, doc: Record<string, unknown> | null | undefined): SettingsMap[K] {
  if (!doc) return structuredClone(SETTINGS_DEFAULTS[id]);
  const { id: _id, updatedAt: _u, updatedBy: _b, ...fields } = doc;
  return { ...structuredClone(SETTINGS_DEFAULTS[id]), ...fields } as SettingsMap[K];
}

const PUBLIC_STATUSES = new Set(['available', 'reserved', 'sold']);
const PRIVATE_CAR_FIELDS = ['createdBy', 'updatedBy', 'deletedBy', 'deletedAt', 'searchText', 'syndication', 'regoExpiry'];

/** Whether a car doc may appear publicly at all. */
export function isPublicCar(c: { published?: unknown; status?: unknown; deletedAt?: unknown }): boolean {
  return c.published === true && !c.deletedAt && PUBLIC_STATUSES.has(String(c.status));
}

/** Strip non-public fields and serialise dates to ISO strings (RSC-safe). */
export function toPublicCar(doc: Record<string, unknown>): PublicCar {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (PRIVATE_CAR_FIELDS.includes(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as unknown as PublicCar;
}

export function sortNewestFirst<T extends object>(rows: T[]): T[] {
  const t = (row: T) => {
    const v = (row as { createdAt?: unknown }).createdAt;
    return v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : 0;
  };
  return [...rows].sort((a, b) => t(b) - t(a));
}
