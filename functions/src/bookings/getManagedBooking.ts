import { carTitle, COLLECTIONS, DEFAULT_TIMEZONE, toIsoInTz, type GetManagedBookingOutput } from '@sda/shared';
import type { Timestamp } from 'firebase-admin/firestore';
import { db, defineCallable } from '../core';
import { getBusinessSettings } from '../core/settings';
import { loadManagedBooking } from './logic';

/** getManagedBooking (public, manage token) – customer view of a booking for /booking/[id]?t=token. */
export const getManagedBooking = defineCallable('getManagedBooking', async (input) => {
  const { data } = await loadManagedBooking(input.bookingId, input.token);
  const [carSnap, business] = await Promise.all([
    db.collection(COLLECTIONS.cars).doc(String(data.carId)).get(),
    getBusinessSettings(),
  ]);
  const car = carSnap.data();
  const tz = business.timezone || DEFAULT_TIMEZONE;
  const out: GetManagedBookingOutput = {
    bookingId: input.bookingId,
    carId: String(data.carId),
    carTitle: car ? carTitle(car as { year: number; make: string; model: string; variant?: string }) : String(data.carTitle ?? ''),
    carSlug: car && car.published ? String(car.slug ?? '') || null : null,
    type: data.type,
    status: data.status,
    startAt: toIsoInTz((data.startAt as Timestamp).toDate(), tz),
    endAt: toIsoInTz((data.endAt as Timestamp).toDate(), tz),
    customer: { name: data.customer.name, email: data.customer.email, phone: data.customer.phone },
  };
  return out;
});
