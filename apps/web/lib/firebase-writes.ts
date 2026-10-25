/**
 * Helpers for CLIENT writes (admin dashboard). Firestore rules require these exact audit fields:
 *   create: createdAt/updatedAt = serverTimestamp(), createdBy/updatedBy = auth uid, deletedAt = null
 *   update: updatedAt = serverTimestamp(), updatedBy = auth uid (createdAt/By unchanged)
 *   soft delete / restore: admin only.  Soft-deleting a car must also set published=false.
 *
 *   await setDoc(doc(getDb(), 'vendors', id), { ...input, ...createFields(uid) });
 *   await updateDoc(ref, { status: 'available', ...updateFields(uid) });
 */
import { DEFAULT_TIMEZONE, zonedToUtc } from '@sda/shared';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export function createFields(uid: string) {
  return {
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    deletedAt: null,
  };
}

export function updateFields(uid: string) {
  return { updatedAt: serverTimestamp(), updatedBy: uid };
}

export function softDeleteFields(uid: string) {
  return { deletedAt: serverTimestamp(), deletedBy: uid, ...updateFields(uid) };
}

export function restoreFields(uid: string) {
  return { deletedAt: null, deletedBy: null, ...updateFields(uid) };
}

/** "YYYY-MM-DD" (form value) → Timestamp at midnight in the dealership zone. */
export function dateKeyToTimestamp(dateKey: string, tz: string = DEFAULT_TIMEZONE): Timestamp {
  return Timestamp.fromDate(zonedToUtc(dateKey, '00:00', tz));
}
