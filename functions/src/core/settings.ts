/** Settings readers with plan defaults (PLACEHOLDER values) when a settings doc is missing. */
import {
  bookingSettingsSchema,
  COLLECTIONS,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_DEPOSIT_AMOUNT_CENTS,
  DEFAULT_DEPOSIT_TERMS_TEXT,
  DEFAULT_TIMEZONE,
  DEPOSIT_TERMS_VERSION,
  type BookingSettings,
  type BusinessSettings,
  type DepositSettings,
} from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { db } from './admin';

async function read(id: string): Promise<Record<string, unknown> | null> {
  const snap = await db.collection(COLLECTIONS.settings).doc(id).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export async function getBookingSettings(): Promise<BookingSettings> {
  const raw = await read('booking');
  const parsed = bookingSettingsSchema.safeParse({ ...structuredClone(DEFAULT_BOOKING_SETTINGS), ...(raw ?? {}) });
  if (!parsed.success) {
    logger.error('settings/booking is invalid – using defaults', { issues: parsed.error.issues });
    return bookingSettingsSchema.parse(structuredClone(DEFAULT_BOOKING_SETTINGS));
  }
  return parsed.data;
}

export type BusinessInfo = Omit<BusinessSettings, 'address'> & { address: BusinessSettings['address'] };

export async function getBusinessSettings(): Promise<BusinessInfo> {
  const raw = (await read('business')) ?? {};
  const merged = { ...DEFAULT_BUSINESS_SETTINGS, ...raw } as unknown as BusinessInfo;
  merged.timezone ||= DEFAULT_TIMEZONE;
  return merged;
}

export async function getDepositSettings(): Promise<DepositSettings> {
  const raw = (await read('deposit')) ?? {};
  return {
    amountCents: typeof raw.amountCents === 'number' ? raw.amountCents : DEFAULT_DEPOSIT_AMOUNT_CENTS,
    termsText: typeof raw.termsText === 'string' && raw.termsText ? raw.termsText : DEFAULT_DEPOSIT_TERMS_TEXT,
    termsVersion: typeof raw.termsVersion === 'string' && raw.termsVersion ? raw.termsVersion : DEPOSIT_TERMS_VERSION,
    enabled: raw.enabled !== false,
  };
}
