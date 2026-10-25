import { PUBLIC_ACTOR } from '@sda/shared';
import { assertTurnstile, defineCallable, bindSecrets } from '../core';
import { sendBookingCreatedEmails } from '../notify/bookings';
import { createBookingTx } from './logic';

/**
 * createBooking (public, Turnstile) – one transaction: re-check availability, create
 * slotLocks/{carId_YYYYMMDD_HHmm} (fails if it exists), increment slotCounts, write the booking with a
 * hashed manage token. Emails (customer confirmation with .ics + manage link, dealership notification)
 * are sent after commit.
 */
export const createBooking = defineCallable('createBooking', async (input, ctx) => {
  await assertTurnstile(input.turnstileToken, ctx.ip);
  const created = await createBookingTx({
    carId: input.carId,
    type: input.type,
    startAt: input.startAt,
    customer: input.customer,
    licenceConfirmed: input.licenceConfirmed,
    notes: input.notes,
    source: 'web',
    actorUid: PUBLIC_ACTOR,
  });
  await sendBookingCreatedEmails(created.email, created.manageToken);
  return { bookingId: created.bookingId, manageToken: created.manageToken, startAt: created.startAt, endAt: created.endAt };
}, { secrets: bindSecrets('TURNSTILE_SECRET_KEY', 'RESEND_API_KEY') });
