import { defineCallable, bindSecrets } from '../core';
import { sendBookingRescheduledEmails } from '../notify/bookings';
import { rescheduleBookingTx } from './logic';

/** rescheduleBooking (public, manage token) – moves the booking to a new open slot in one transaction. */
export const rescheduleBooking = defineCallable('rescheduleBooking', async (input) => {
  const r = await rescheduleBookingTx(input.bookingId, input.token, input.startAt);
  if (r.changed) await sendBookingRescheduledEmails(r.email, r.oldStart, input.token);
  return { ok: true as const, startAt: r.startAt, endAt: r.endAt };
}, { secrets: bindSecrets('RESEND_API_KEY') });
