import { z } from 'zod';
import { ROLES } from '../constants';
import { auditFieldsSchema, zEmail, zName, zTimestamp } from './common';

export const roleSchema = z.enum(ROLES);

/** `users/{uid}` – admin write; user reads self. Role mirror of the custom claim. */
export const userSchema = z
  .object({
    name: zName,
    email: zEmail,
    role: roleSchema,
    active: z.boolean(),
    lastLoginAt: zTimestamp.nullable().optional(),
    invitedAt: zTimestamp.nullable().optional(),
  })
  .extend(auditFieldsSchema.shape);
export type UserDoc = z.infer<typeof userSchema>;

/** Custom claims set by setUserRole / createAdmin. */
export const authClaimsSchema = z.object({ role: roleSchema.optional() });
export type AuthClaims = z.infer<typeof authClaimsSchema>;
