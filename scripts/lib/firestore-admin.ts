/** firebase-admin helpers shared by the seed scripts. */
import { Timestamp } from 'firebase-admin/firestore';

/** Recursively convert Date → Firestore Timestamp (plain objects and arrays only). */
export function toFirestore(value: unknown): unknown {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(toFirestore);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toFirestore(v)]));
  }
  return value;
}

/** A doc without its `id`, converted for a firebase-admin write. */
export function docData(doc: { id: string } & Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...data } = doc;
  return toFirestore(data) as Record<string, unknown>;
}
