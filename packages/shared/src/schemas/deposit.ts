import { z } from 'zod';
import { DEPOSIT_STATUSES } from '../constants';
import { auditFieldsSchema, zCents, zEmail, zName, zPhone, zTimestamp } from './common';

export const depositStatusSchema = z.enum(DEPOSIT_STATUSES);

/** Stored `deposits/{depositId}` (functions write; admin reads). */
export const depositSchema = z
  .object({
    carId: z.string(),
    carTitle: z.string().optional(),
    stockNo: z.string().optional(),
    amountCents: zCents,
    customer: z.object({ name: zName, email: zEmail, phone: zPhone }),
    stripeSessionId: z.string().nullable().optional(),
    stripePaymentIntentId: z.string().nullable().optional(),
    status: depositStatusSchema,
    termsAcceptedAt: zTimestamp,
    termsVersion: z.string(),
    paidAt: zTimestamp.nullable().optional(),
    expiredAt: zTimestamp.nullable().optional(),
    /** Admin marks a conflict resolved after handling it in the Stripe dashboard. */
    conflictResolvedAt: zTimestamp.nullable().optional(),
    conflictResolvedBy: z.string().nullable().optional(),
    conflictNote: z.string().max(2000).optional(),
  })
  .extend(auditFieldsSchema.shape);
export type Deposit = z.infer<typeof depositSchema>;

/** The only fields an admin may update directly (rules enforce the same list). */
export const depositConflictResolutionSchema = z.object({
  conflictNote: z.string().trim().max(2000).default(''),
});
export const DEPOSIT_ADMIN_EDITABLE_FIELDS = [
  'conflictResolvedAt',
  'conflictResolvedBy',
  'conflictNote',
  'updatedAt',
  'updatedBy',
] as const;
