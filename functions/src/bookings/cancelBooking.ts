import { defineCallable, bindSecrets } from '../core';
import { sendBookingCancelledEmails } from '../notify/bookings';
import { bookingForEmail, cancelBookingTx, carLite } from './logic';
import { db } from '../core/admin';

/** cancelBooking (public, manage token) – cancels, releases the slot lock, decrements the count, emails both sides. */
export const cancelBooking = defineCallable('cancelBooking', async (input) => {
  const r = await cancelBookingTx(input.bookingId, input.token);
  if (r.changed) {
    const car = carLite(await db.collection('cars').doc(String(r.data.carId)).get());
    await sendBookingCancelledEmails(bookingForEmail(input.bookingId, r.data, car?.slug ?? null));
  }
  return { ok: true as const };
}, { secrets: bindSecrets('RESEND_API_KEY') });
