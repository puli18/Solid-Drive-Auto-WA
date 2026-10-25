import { z } from 'zod';
import { AUDIT_ACTIONS } from '../constants';
import { zTimestamp } from './common';

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export const AUDIT_ENTITIES = [
  'car',
  'carFinancials',
  'expense',
  'sale',
  'booking',
  'deposit',
  'enquiry',
  'vendor',
  'user',
  'settings',
  'export',
] as const;
export const auditEntitySchema = z.enum(AUDIT_ENTITIES);
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/** `auditLog/{id}` – functions write; admin read. `before`/`after` are partial snapshots (changed fields). */
export const auditLogSchema = z.object({
  actorUid: z.string(),
  action: auditActionSchema,
  entity: auditEntitySchema,
  entityId: z.string(),
  /** For sub-entities (expenses) the parent car id, so the car Activity tab can query by carId. */
  carId: z.string().nullable().optional(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  at: zTimestamp,
});
export type AuditLogEntry = z.infer<typeof auditLogSchema>;
