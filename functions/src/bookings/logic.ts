/**
 * Booking core: availability, create / cancel / reschedule inside Firestore transactions.
 *
 * Double-booking protection: each booking holds `slotLocks/{carId_YYYYMMDD_HHmm}` (created with
 * `tx.create`, so a second booking for the same car + slot fails) and `slotCounts/{YYYYMMDD_HHmm}`
 * enforces `maxPerSlot` across cars. Both are re-checked inside the transaction.
 */
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  carTitle,
  isValidSlotStart,
  openSlotsForDate,
  slotKey,
  slotLockId,
  toIsoInTz,
  type BookingSettings,
  type BookingSource,
  type BookingStatus,
  type BookingType,
  type Customer,
} from '@sda/shared';
import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { db, FieldValue, Timestamp } from '../core/admin';
import { writeAudit } from '../core/audit';
import { HttpsError } from '../core/errors';
import { getBookingSettings, getBusinessSettings } from '../core/settings';
import { hashToken, newManageToken, tokenMatches } from '../core/tokens';
import type { BookingForEmail } from '../notify/bookings';

export interface CarLite {
  id: string;
  title: string;
  slug: string | null;
  stockNo: string;
  status: string;
  published: boolean;
  deleted: boolean;
}

export function carLite(snap: DocumentSnapshot): CarLite | null {
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    title: carTitle({ year: Number(d.year), make: String(d.make ?? ''), model: String(d.model ?? ''), variant: (d.variant as string) ?? '' }),
    slug: (d.slug as string) ?? null,
    stockNo: String(d.stockNo ?? ''),
    status: String(d.status ?? ''),
    published: d.published === true,
    deleted: !!d.deletedAt,
  };
}

export const isBookable = (c: CarLite | null): c is CarLite => !!c && c.published && c.status === 'available' && !c.deleted;

const carRef = (id: string) => db.collection(COLLECTIONS.cars).doc(id);
const lockRef = (id: string) => db.collection(COLLECTIONS.slotLocks).doc(id);
const countRef = (id: string) => db.collection(COLLECTIONS.slotCounts).doc(id);
const bookingRef = (id: string) => db.collection(COLLECTIONS.bookings).doc(id);

export interface BookingContext {
  settings: BookingSettings;
  tz: string;
  now: Date;
}

export async function bookingContext(now = new Date()): Promise<BookingContext> {
  const [settings, business] = await Promise.all([getBookingSettings(), getBusinessSettings()]);
  return { settings, tz: business.timezone || DEFAULT_TIMEZONE, now };
}

/** Staff bookings (phone customers) may ignore minNoticeHours; all other rules still apply. */
const rulesFor = (ctx: BookingContext, ignoreNotice: boolean): BookingSettings =>
  ignoreNotice ? { ...ctx.settings, minNoticeHours: 0 } : ctx.settings;

export async function computeAvailability(
  carId: string,
  date: string,
  opts: { now?: Date; ignoreNotice?: boolean } = {},
): Promise<{ date: string; timezone: string; slots: string[] }> {
  const ctx = await bookingContext(opts.now);
  const car = carLite(await carRef(carId).get());
  if (!isBookable(car)) return { date, timezone: ctx.tz, slots: [] };
  const candidates = openSlotsForDate(rulesFor(ctx, !!opts.ignoreNotice), date, ctx.now, ctx.tz);
  if (!candidates.length) return { date, timezone: ctx.tz, slots: [] };
  const locks = candidates.map((s) => lockRef(slotLockId(carId, s.startAt, ctx.tz)));
  const counts = candidates.map((s) => countRef(slotKey(s.startAt, ctx.tz)));
  const snaps = await db.getAll(...locks, ...counts);
  const lockSnaps = snaps.slice(0, candidates.length);
  const countSnaps = snaps.slice(candidates.length);
  const slots = candidates
    .filter((_, i) => !lockSnaps[i]!.exists && ((countSnaps[i]!.data()?.count as number | undefined) ?? 0) < ctx.settings.maxPerSlot)
    .map((s) => s.iso);
  return { date, timezone: ctx.tz, slots };
}

/** tx.getAll for two refs, typed as a pair. */
async function getPair(tx: Transaction, a: DocumentReference, b: DocumentReference): Promise<[DocumentSnapshot, DocumentSnapshot]> {
  const [x, y] = await tx.getAll(a, b);
  return [x!, y!];
}

/** Maps transaction contention (gRPC ABORTED) to a friendly retryable error. */
async function runTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  try {
    return await db.runTransaction(fn, { maxAttempts: 10 });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if ((err as { code?: number }).code === 10) {
      throw new HttpsError('aborted', 'That time is in high demand. Please try again.');
    }
    throw err;
  }
}

function assertSlot(ctx: BookingContext, startAt: Date, ignoreNotice: boolean) {
  if (Number.isNaN(startAt.getTime()) || !isValidSlotStart(rulesFor(ctx, ignoreNotice), startAt, ctx.now, ctx.tz)) {
    throw new HttpsError('failed-precondition', 'That time is not available. Please choose another time.');
  }
}

/** Reads lock + count for a slot and throws if it can't take another booking (call before any writes). */
async function readSlot(tx: Transaction, carId: string, startAt: Date, ctx: BookingContext, ownBookingId?: string) {
  const lId = slotLockId(carId, startAt, ctx.tz);
  const cId = slotKey(startAt, ctx.tz);
  const [lockSnap, countSnap] = await getPair(tx, lockRef(lId), countRef(cId));
  const holder = lockSnap.exists ? (lockSnap.data()!.bookingId as string) : null;
  if (holder && holder !== ownBookingId) {
    throw new HttpsError('already-exists', 'Sorry, that time was just booked. Please choose another time.');
  }
  const count = (countSnap.data()?.count as number | undefined) ?? 0;
  if (!holder && count >= ctx.settings.maxPerSlot) {
    throw new HttpsError('resource-exhausted', 'That time is fully booked. Please choose another time.');
  }
  return { lockId: lId, countId: cId, count, alreadyHeld: !!holder };
}

function takeSlot(tx: Transaction, slot: { lockId: string; countId: string; count: number }, bookingId: string, carId: string) {
  tx.create(lockRef(slot.lockId), { bookingId, carId, createdAt: FieldValue.serverTimestamp() });
  tx.set(countRef(slot.countId), { count: slot.count + 1, updatedAt: FieldValue.serverTimestamp() });
}

/** Release a slot the booking holds. `lockSnap`/`countSnap` must have been read in the same transaction. */
export function releaseSlotWrites(
  tx: Transaction,
  bookingId: string,
  lockSnap: DocumentSnapshot,
  countSnap: DocumentSnapshot,
): boolean {
  if (!lockSnap.exists || lockSnap.data()!.bookingId !== bookingId) return false;
  tx.delete(lockSnap.ref);
  const count = (countSnap.data()?.count as number | undefined) ?? 0;
  tx.set(countSnap.ref as DocumentReference, { count: Math.max(0, count - 1), updatedAt: FieldValue.serverTimestamp() });
  return true;
}

/** Lock + count refs for a stored booking (falls back to computing the lock id from startAt). */
export function slotRefsForBooking(bookingId: string, data: Record<string, unknown>, tz: string) {
  const start = (data.startAt as Timestamp).toDate();
  return {
    lock: lockRef((data.slotLockId as string) || slotLockId(String(data.carId), start, tz)),
    count: countRef(slotKey(start, tz)),
    bookingId,
  };
}

export interface CreateBookingArgs {
  carId: string;
  type: BookingType;
  startAt: string;
  customer: Customer;
  licenceConfirmed: boolean;
  notes: string;
  source: BookingSource;
  actorUid: string;
  now?: Date;
}

export interface CreatedBooking {
  bookingId: string;
  manageToken: string;
  startAt: string;
  endAt: string;
  email: BookingForEmail;
}

export async function createBookingTx(args: CreateBookingArgs): Promise<CreatedBooking> {
  const ctx = await bookingContext(args.now);
  const ignoreNotice = args.source === 'staff';
  const startAt = new Date(args.startAt);
  assertSlot(ctx, startAt, ignoreNotice);
  const endAt = new Date(startAt.getTime() + ctx.settings.slotMinutes * 60_000);
  const token = newManageToken();
  const ref = db.collection(COLLECTIONS.bookings).doc();

  const car = await runTx(async (tx) => {
    const car = carLite(await tx.get(carRef(args.carId)));
    if (!isBookable(car)) throw new HttpsError('failed-precondition', 'This car is no longer available to book.');
    const slot = await readSlot(tx, args.carId, startAt, ctx);
    takeSlot(tx, slot, ref.id, args.carId);
    const now = FieldValue.serverTimestamp();
    tx.create(ref, {
      carId: args.carId,
      carTitle: car.title,
      stockNo: car.stockNo,
      type: args.type,
      startAt: Timestamp.fromDate(startAt),
      endAt: Timestamp.fromDate(endAt),
      customer: args.customer,
      licenceConfirmed: args.licenceConfirmed,
      status: 'confirmed' satisfies BookingStatus,
      manageToken: hashToken(token),
      notes: args.notes ?? '',
      source: args.source,
      slotLockId: slot.lockId,
      reminderSentAt: null,
      cancelledAt: null,
      createdAt: now,
      createdBy: args.actorUid,
      updatedAt: now,
      updatedBy: args.actorUid,
      deletedAt: null,
    });
    await writeAudit(
      {
        actorUid: args.actorUid,
        action: 'booking-created',
        entity: 'booking',
        entityId: ref.id,
        carId: args.carId,
        after: { type: args.type, startAt: toIsoInTz(startAt, ctx.tz), source: args.source, customer: args.customer.name },
      },
      tx,
    );
    return car;
  });

  return {
    bookingId: ref.id,
    manageToken: token,
    startAt: toIsoInTz(startAt, ctx.tz),
    endAt: toIsoInTz(endAt, ctx.tz),
    email: {
      id: ref.id,
      carId: args.carId,
      carTitle: car.title,
      carSlug: car.slug,
      stockNo: car.stockNo,
      type: args.type,
      startAt,
      endAt,
      customer: args.customer,
      source: args.source,
      notes: args.notes,
    },
  };
}

/** Loads a booking and checks the manage token. Same error for "missing" and "bad token". */
export async function loadManagedBooking(bookingId: string, token: string) {
  const snap = await bookingRef(bookingId).get();
  const data = snap.data();
  if (!snap.exists || !data || data.deletedAt || !tokenMatches(token, data.manageToken as string)) {
    throw new HttpsError('not-found', 'Booking not found, or the link has expired.');
  }
  return { snap, data };
}

export function bookingForEmail(id: string, d: Record<string, unknown>, slug: string | null = null): BookingForEmail {
  return {
    id,
    carId: String(d.carId),
    carTitle: String(d.carTitle ?? ''),
    carSlug: slug,
    stockNo: String(d.stockNo ?? ''),
    type: d.type as BookingType,
    startAt: (d.startAt as Timestamp).toDate(),
    endAt: (d.endAt as Timestamp).toDate(),
    customer: d.customer as Customer,
    source: d.source as BookingSource,
    notes: (d.notes as string) ?? '',
  };
}

export async function cancelBookingTx(bookingId: string, token: string, now = new Date()) {
  await loadManagedBooking(bookingId, token);
  const ctx = await bookingContext(now);
  return runTx(async (tx) => {
    const snap = await tx.get(bookingRef(bookingId));
    const d = snap.data()!;
    if (d.status === 'cancelled') return { changed: false as const, data: d };
    if (d.status !== 'confirmed') throw new HttpsError('failed-precondition', 'This booking can no longer be cancelled.');
    if ((d.startAt as Timestamp).toMillis() < now.getTime()) {
      throw new HttpsError('failed-precondition', 'This booking has already started.');
    }
    const refs = slotRefsForBooking(bookingId, d, ctx.tz);
    const [lockSnap, countSnap] = await getPair(tx, refs.lock, refs.count);
    releaseSlotWrites(tx, bookingId, lockSnap, countSnap);
    tx.update(snap.ref, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'public',
    });
    await writeAudit(
      { actorUid: 'public', action: 'booking-cancelled', entity: 'booking', entityId: bookingId, carId: String(d.carId), before: { status: d.status }, after: { status: 'cancelled' } },
      tx,
    );
    return { changed: true as const, data: d };
  });
}

export async function rescheduleBookingTx(bookingId: string, token: string, newStartIso: string, now = new Date()) {
  await loadManagedBooking(bookingId, token);
  const ctx = await bookingContext(now);
  const newStart = new Date(newStartIso);
  assertSlot(ctx, newStart, false);
  const newEnd = new Date(newStart.getTime() + ctx.settings.slotMinutes * 60_000);

  const result = await runTx(async (tx) => {
    const snap = await tx.get(bookingRef(bookingId));
    const d = snap.data()!;
    if (d.status !== 'confirmed') throw new HttpsError('failed-precondition', 'Only confirmed bookings can be moved.');
    const oldStart = (d.startAt as Timestamp).toDate();
    if (oldStart.getTime() < now.getTime()) throw new HttpsError('failed-precondition', 'This booking has already started.');
    const car = carLite(await tx.get(carRef(String(d.carId))));
    if (!isBookable(car)) throw new HttpsError('failed-precondition', 'This car is no longer available to book.');
    if (oldStart.getTime() === newStart.getTime()) return { d, oldStart, car, changed: false };

    const old = slotRefsForBooking(bookingId, d, ctx.tz);
    const [oldLock, oldCount] = await getPair(tx, old.lock, old.count);
    const slot = await readSlot(tx, String(d.carId), newStart, ctx, bookingId);
    // Different start times always map to different lock/count docs (same time returned above).
    releaseSlotWrites(tx, bookingId, oldLock, oldCount);
    takeSlot(tx, slot, bookingId, String(d.carId));
    tx.update(snap.ref, {
      startAt: Timestamp.fromDate(newStart),
      endAt: Timestamp.fromDate(newEnd),
      slotLockId: slot.lockId,
      reminderSentAt: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'public',
    });
    await writeAudit(
      {
        actorUid: 'public',
        action: 'booking-rescheduled',
        entity: 'booking',
        entityId: bookingId,
        carId: String(d.carId),
        before: { startAt: toIsoInTz(oldStart, ctx.tz) },
        after: { startAt: toIsoInTz(newStart, ctx.tz) },
      },
      tx,
    );
    return { d, oldStart, car, changed: true };
  });

  return {
    ...result,
    startAt: toIsoInTz(newStart, ctx.tz),
    endAt: toIsoInTz(newEnd, ctx.tz),
    email: { ...bookingForEmail(bookingId, result.d, result.car?.slug ?? null), startAt: newStart, endAt: newEnd },
  };
}

/** Releases the slot of a booking that was cancelled from the dashboard (idempotent). */
export async function releaseBookingSlot(bookingId: string): Promise<boolean> {
  const ctx = await bookingContext();
  return runTx(async (tx) => {
    const snap = await tx.get(bookingRef(bookingId));
    if (!snap.exists) return false;
    const refs = slotRefsForBooking(bookingId, snap.data()!, ctx.tz);
    const [lockSnap, countSnap] = await getPair(tx, refs.lock, refs.count);
    return releaseSlotWrites(tx, bookingId, lockSnap, countSnap);
  });
}
