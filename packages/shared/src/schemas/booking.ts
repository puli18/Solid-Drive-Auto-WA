import { z } from 'zod';
import { BOOKING_SOURCES, BOOKING_STATUSES, BOOKING_TYPES } from '../constants';
import { auditFieldsSchema, customerSchema, zTimestamp } from './common';

export const bookingTypeSchema = z.enum(BOOKING_TYPES);
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const bookingSourceSchema = z.enum(BOOKING_SOURCES);

/** Stored `bookings/{bookingId}` (created only by functions). */
export const bookingSchema = z
  .object({
    carId: z.string(),
    /** Denormalised for lists/emails. */
    carTitle: z.string().optional(),
    stockNo: z.string().optional(),
    type: bookingTypeSchema,
    startAt: zTimestamp,
    endAt: zTimestamp,
    customer: customerSchema,
    licenceConfirmed: z.boolean(),
    status: bookingStatusSchema,
    /** SHA-256 hex of the manage token. The raw token is only ever emailed to the customer. */
    manageToken: z.string(),
    notes: z.string().max(5000).default(''),
    source: bookingSourceSchema,
    /** slotLocks doc id held by this booking (released on cancel/reschedule). */
    slotLockId: z.string().optional(),
    reminderSentAt: zTimestamp.nullable().optional(),
    cancelledAt: zTimestamp.nullable().optional(),
  })
  .extend(auditFieldsSchema.shape);
export type Booking = z.infer<typeof bookingSchema>;

/** Fields admin/staff may change directly from the dashboard (rules enforce the same list). */
export const bookingStaffUpdateSchema = z.object({
  status: bookingStatusSchema.optional(),
  notes: z.string().max(5000).optional(),
});
export type BookingStaffUpdate = z.infer<typeof bookingStaffUpdateSchema>;
export const BOOKING_STAFF_EDITABLE_FIELDS = ['status', 'notes', 'updatedAt', 'updatedBy'] as const;

/** `slotLocks/{carId_YYYYMMDD_HHmm}` – functions only. */
export const slotLockSchema = z.object({ bookingId: z.string(), createdAt: zTimestamp });
export type SlotLock = z.infer<typeof slotLockSchema>;

/** `slotCounts/{YYYYMMDD_HHmm}` – functions only. */
export const slotCountSchema = z.object({ count: z.number().int().nonnegative() });
export type SlotCount = z.infer<typeof slotCountSchema>;
