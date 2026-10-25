/** Audit log writer: `auditLog/{id}` (functions write; admin read). */
import type { AuditAction, AuditEntity } from '@sda/shared';
import { COLLECTIONS } from '@sda/shared';
import type { Transaction, WriteBatch } from 'firebase-admin/firestore';
import { db, FieldValue } from './admin';
export { diffFields } from './audit-diff';

export interface AuditEntryInput {
  actorUid: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  carId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

function toDoc(entry: AuditEntryInput) {
  return {
    actorUid: entry.actorUid,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    carId: entry.carId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    at: FieldValue.serverTimestamp(),
  };
}

/** Write an audit entry. Pass a transaction/batch to make it atomic with the change. */
export async function writeAudit(entry: AuditEntryInput, tx?: Transaction | WriteBatch): Promise<void> {
  const ref = db.collection(COLLECTIONS.auditLog).doc();
  if (tx) {
    (tx as WriteBatch).set(ref, toDoc(entry));
    return;
  }
  await ref.set(toDoc(entry));
}
