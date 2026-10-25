import { COLLECTIONS, slotKey, slotLockId, zonedToUtc, toIsoInTz } from '@sda/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/core/admin';
import { createBooking } from '../../src/bookings/createBooking';
import { cancelBooking } from '../../src/bookings/cancelBooking';
import { rescheduleBooking } from '../../src/bookings/rescheduleBooking';
import { getAvailability } from '../../src/bookings/getAvailability';
import { getManagedBooking } from '../../src/bookings/getManagedBooking';
import { staffCreateBooking } from '../../src/bookings/staffCreateBooking';
import { onBookingStatusChange } from '../../src/bookings/onBookingStatusChange';
import { runBookingReminders } from '../../src/bookings/sendBookingReminders';
import { callReq, count, nextWeekday, resetFirestore, seedCar, seedSettings, TOKEN } from './helpers';

const TZ = 'Australia/Perth';
const customer = (i = 0) => ({ name: `Customer ${i}`, phone: '0400 555 1' + String(i).padStart(2, '0'), email: `c${i}@example.com` });
const bookingInput = (carId: string, startAt: string, i = 0) => ({
  carId,
  type: 'inspection' as const,
  startAt,
  customer: customer(i),
  licenceConfirmed: false,
  turnstileToken: TOKEN,
});

const date = nextWeekday();
const at = (hhmm: string) => toIsoInTz(zonedToUtc(date, hhmm, TZ), TZ);

beforeEach(async () => {
  await resetFirestore();
  await seedSettings();
  await seedCar('car-a');
  await seedCar('car-b');
  await seedCar('car-c');
});

describe('availability', () => {
  it('returns slots from weeklyHours (45 min + 15 buffer) for a weekday', async () => {
    const r = await getAvailability.run(callReq({ carId: 'car-a', date }));
    expect(r.slots[0]).toBe(at('09:00'));
    expect(r.slots[1]).toBe(at('10:00'));
    expect(r.slots).toHaveLength(8); // 9:00 … 16:00 (16:00+45 <= 17:00)
  });

  it('returns nothing for blackout dates, unpublished/unavailable cars and past dates', async () => {
    await db.doc('settings/booking').update({ blackoutDates: [date] });
    expect((await getAvailability.run(callReq({ carId: 'car-a', date }))).slots).toEqual([]);
    await db.doc('settings/booking').update({ blackoutDates: [] });
    await db.doc('cars/car-b').update({ status: 'reserved' });
    expect((await getAvailability.run(callReq({ carId: 'car-b', date }))).slots).toEqual([]);
    await db.doc('cars/car-c').update({ published: false });
    expect((await getAvailability.run(callReq({ carId: 'car-c', date }))).slots).toEqual([]);
    expect((await getAvailability.run(callReq({ carId: 'car-a', date: '2020-01-06' }))).slots).toEqual([]);
  });

  it('rejects a booking on a blackout date', async () => {
    await db.doc('settings/booking').update({ blackoutDates: [date] });
    await expect(createBooking.run(callReq(bookingInput('car-a', at('10:00'))))).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await count(COLLECTIONS.bookings)).toBe(0);
  });

  it('rejects a start time that is not a slot', async () => {
    await expect(createBooking.run(callReq(bookingInput('car-a', at('10:20'))))).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('createBooking concurrency (M5)', () => {
  it('10 simultaneous bookings for the same car and slot create exactly 1', async () => {
    const start = at('11:00');
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => createBooking.run(callReq(bookingInput('car-a', start, i)))),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(9);
    for (const f of failed) expect(['already-exists', 'aborted']).toContain((f.reason as { code: string }).code);
    expect(await count(COLLECTIONS.bookings)).toBe(1);
    expect(await count(COLLECTIONS.slotLocks)).toBe(1);
    const startDate = new Date(start);
    expect((await db.doc(`slotCounts/${slotKey(startDate, TZ)}`).get()).data()?.count).toBe(1);
    // The slot no longer shows for that car.
    expect((await getAvailability.run(callReq({ carId: 'car-a', date }))).slots).not.toContain(start);
  });

  it('enforces maxPerSlot across cars', async () => {
    const start = at('12:00');
    await createBooking.run(callReq(bookingInput('car-a', start, 1)));
    await createBooking.run(callReq(bookingInput('car-b', start, 2)));
    await expect(createBooking.run(callReq(bookingInput('car-c', start, 3)))).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect((await getAvailability.run(callReq({ carId: 'car-c', date }))).slots).not.toContain(start);
    expect(await count(COLLECTIONS.bookings)).toBe(2);
  });

  it('enforces maxPerSlot under concurrency', async () => {
    await db.doc('settings/booking').update({ maxPerSlot: 1 });
    const start = at('13:00');
    const results = await Promise.allSettled(['car-a', 'car-b', 'car-c'].map((c, i) => createBooking.run(callReq(bookingInput(c, start, i)))));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await count(COLLECTIONS.bookings)).toBe(1);
  });
});

describe('manage, cancel, reschedule', () => {
  it('stores only the token hash; manage link works; wrong token is rejected', async () => {
    const r = await createBooking.run(callReq(bookingInput('car-a', at('09:00'))));
    const doc = (await db.doc(`bookings/${r.bookingId}`).get()).data()!;
    expect(doc.manageToken).not.toBe(r.manageToken);
    expect(doc.manageToken).toMatch(/^[0-9a-f]{64}$/);
    const view = await getManagedBooking.run(callReq({ bookingId: r.bookingId, token: r.manageToken }));
    expect(view).toMatchObject({ status: 'confirmed', startAt: at('09:00'), carId: 'car-a' });
    await expect(getManagedBooking.run(callReq({ bookingId: r.bookingId, token: 'x'.repeat(32) }))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('cancel releases the lock and count (slot bookable again)', async () => {
    const start = at('14:00');
    const r = await createBooking.run(callReq(bookingInput('car-a', start)));
    await cancelBooking.run(callReq({ bookingId: r.bookingId, token: r.manageToken }));
    expect((await db.doc(`bookings/${r.bookingId}`).get()).data()!.status).toBe('cancelled');
    expect((await db.doc(`slotLocks/${slotLockId('car-a', new Date(start), TZ)}`).get()).exists).toBe(false);
    expect((await db.doc(`slotCounts/${slotKey(new Date(start), TZ)}`).get()).data()?.count).toBe(0);
    await expect(createBooking.run(callReq(bookingInput('car-a', start, 2)))).resolves.toBeTruthy();
  });

  it('reschedule moves the lock and count', async () => {
    const r = await createBooking.run(callReq(bookingInput('car-a', at('09:00'))));
    const moved = await rescheduleBooking.run(callReq({ bookingId: r.bookingId, token: r.manageToken, startAt: at('15:00') }));
    expect(moved.startAt).toBe(at('15:00'));
    expect((await db.doc(`slotLocks/${slotLockId('car-a', new Date(at('09:00')), TZ)}`).get()).exists).toBe(false);
    expect((await db.doc(`slotLocks/${slotLockId('car-a', new Date(at('15:00')), TZ)}`).get()).data()?.bookingId).toBe(r.bookingId);
    expect((await db.doc(`slotCounts/${slotKey(new Date(at('09:00')), TZ)}`).get()).data()?.count).toBe(0);
    expect((await db.doc(`slotCounts/${slotKey(new Date(at('15:00')), TZ)}`).get()).data()?.count).toBe(1);
  });

  it('onBookingStatusChange releases the slot when staff cancel from the dashboard (idempotent)', async () => {
    const start = at('16:00');
    const r = await staffCreateBooking.run(
      callReq({ carId: 'car-b', type: 'test-drive', startAt: start, customer: customer(5), licenceConfirmed: true }, { uid: 'staff-1', role: 'staff' }),
    );
    const ref = db.doc(`bookings/${r.bookingId}`);
    const before = await ref.get();
    await ref.update({ status: 'cancelled', updatedBy: 'staff-1' });
    const after = await ref.get();
    const event = { params: { bookingId: r.bookingId }, data: { before, after } } as never;
    await onBookingStatusChange.run(event);
    await onBookingStatusChange.run(event);
    expect((await db.doc(`slotLocks/${slotLockId('car-b', new Date(start), TZ)}`).get()).exists).toBe(false);
    expect((await db.doc(`slotCounts/${slotKey(new Date(start), TZ)}`).get()).data()?.count).toBe(0);
  });

  it('staffCreateBooking needs staff or admin', async () => {
    const input = { carId: 'car-a', type: 'inspection', startAt: at('10:00'), customer: customer(), licenceConfirmed: false };
    await expect(staffCreateBooking.run(callReq(input))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(staffCreateBooking.run(callReq(input, { uid: 'x' }))).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('reminders', () => {
  it('sends one reminder for bookings made >24 h ahead starting within 24 h', async () => {
    const r = await createBooking.run(callReq(bookingInput('car-a', at('10:00'))));
    const start = new Date(at('10:00'));
    // Pretend the booking was made 3 days before and it's now 20 h before start.
    await db.doc(`bookings/${r.bookingId}`).update({ createdAt: new Date(start.getTime() - 3 * 86_400_000) });
    const now = new Date(start.getTime() - 20 * 3_600_000);
    expect((await runBookingReminders(now)).sent).toBe(1);
    expect((await runBookingReminders(now)).sent).toBe(0);
    expect((await db.doc(`bookings/${r.bookingId}`).get()).data()!.reminderSentAt).toBeTruthy();
  });
});
