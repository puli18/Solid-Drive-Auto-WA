import { z } from 'zod';

/**
 * A Firestore Timestamp from either SDK (client `firebase/firestore` or `firebase-admin`), or a JS Date.
 * Stored-document schemas use this; input (form / callable) schemas use ISO strings instead.
 */
export interface TimestampLike {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}
export const zTimestamp = z.custom<TimestampLike | Date>(
  (v) =>
    v instanceof Date ||
    (typeof v === 'object' && v !== null && typeof (v as TimestampLike).toDate === 'function'),
  { message: 'Expected a Firestore Timestamp' },
);

/** Calendar date "YYYY-MM-DD" (form + callable inputs). */
export const zDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
/** ISO instant with offset, e.g. 2026-10-27T09:00:00+08:00 */
export const zIsoDateTime = z.iso.datetime({ offset: true });
/** "HH:mm" 24h */
export const zHhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

/** Integer cents, non-negative. */
export const zCents = z.number().int('Must be whole cents').nonnegative();
/** Integer cents, may be negative (adjustments). */
export const zSignedCents = z.number().int('Must be whole cents');

export const zId = z.string().min(1).max(128);
export const zEmail = z.email('Enter a valid email').max(254);
/** Loose AU phone: digits, spaces, +, (), -; 8–15 digits. */
export const zPhone = z
  .string()
  .trim()
  .refine((v) => {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 && /^[\d\s+()-]+$/.test(v);
  }, 'Enter a valid phone number');
export const zName = z.string().trim().min(1, 'Required').max(120);
export const zText = (max = 2000) => z.string().trim().max(max);
export const zOptionalText = (max = 2000) => z.string().trim().max(max).optional();

export const zYear = z
  .number()
  .int()
  .min(1950)
  .max(new Date().getFullYear() + 1);

/** Audit fields present on every client- or function-written document. */
export const auditFieldsSchema = z.object({
  createdAt: zTimestamp,
  createdBy: z.string(),
  updatedAt: zTimestamp,
  updatedBy: z.string(),
  deletedAt: zTimestamp.nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});
export type AuditFields = z.infer<typeof auditFieldsSchema>;

/** Actor id used when a Cloud Function writes on behalf of the system / a public customer. */
export const SYSTEM_ACTOR = 'system';
export const PUBLIC_ACTOR = 'public';

export const customerSchema = z.object({
  name: zName,
  phone: zPhone,
  email: zEmail,
});
export type Customer = z.infer<typeof customerSchema>;

export const addressSchema = z.object({
  line1: z.string().trim().max(200),
  line2: z.string().trim().max(200).optional().default(''),
  suburb: z.string().trim().max(100),
  state: z.string().trim().max(10),
  postcode: z.string().trim().max(10),
  country: z.string().trim().max(60).optional().default('Australia'),
});
export type Address = z.infer<typeof addressSchema>;

/** Adds `id` to a document type once read. */
export type WithId<T> = T & { id: string };
