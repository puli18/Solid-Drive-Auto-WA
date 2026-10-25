import { defineCallable, bindSecrets } from '../core';
import { sendBookingCreatedEmails } from '../notify/bookings';
import { createBookingTx } from './logic';

/**
 * staffCreateBooking (staff, admin) – booking on behalf of a phone customer, no Turnstile.
 * Same transaction and slot rules as createBooking, except minNoticeHours is not applied.
 */
export const staffCreateBooking = defineCallable('staffCreateBooking', async (input, ctx) => {
  const created = await createBookingTx({
    carId: input.carId,
    type: input.type,
    startAt: input.startAt,
    customer: input.customer,
    licenceConfirmed: input.licenceConfirmed,
    notes: input.notes,
    source: 'staff',
    actorUid: ctx.uid!,
  });
  await sendBookingCreatedEmails(created.email, created.manageToken);
  return { bookingId: created.bookingId, manageToken: created.manageToken, startAt: created.startAt, endAt: created.endAt };
}, { secrets: bindSecrets('RESEND_API_KEY') });
