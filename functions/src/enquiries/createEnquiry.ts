import { COLLECTIONS, PUBLIC_ACTOR, TRADE_IN_IMAGE_PREFIX } from '@sda/shared';
import { assertTurnstile, db, defineCallable, FieldValue, HttpsError, bindSecrets } from '../core';
import { carLite } from '../bookings/logic';
import { sendEnquiryEmails } from '../notify/enquiries';

/** createEnquiry (public, Turnstile) – general and trade-in enquiries; emails the customer and the dealership. */
export const createEnquiry = defineCallable('createEnquiry', async (input, ctx) => {
  await assertTurnstile(input.turnstileToken, ctx.ip);
  const tradeIn = input.type === 'trade-in' ? (input.tradeInVehicle ?? null) : null;
  if (tradeIn?.images.some((id) => !id.startsWith(TRADE_IN_IMAGE_PREFIX))) {
    throw new HttpsError('invalid-argument', 'Invalid photo reference', { issues: [{ path: 'tradeInVehicle.images', message: 'Invalid photo' }] });
  }
  let carTitle: string | null = null;
  if (input.carId) {
    const car = carLite(await db.collection(COLLECTIONS.cars).doc(input.carId).get());
    if (!car || !car.published || car.deleted) throw new HttpsError('not-found', 'That car could not be found.');
    carTitle = `${car.title} (${car.stockNo})`;
  }
  const ref = db.collection(COLLECTIONS.enquiries).doc();
  const now = FieldValue.serverTimestamp();
  await ref.create({
    type: input.type,
    carId: input.carId ?? null,
    carTitle: carTitle ?? '',
    customer: input.customer,
    message: input.message,
    tradeInVehicle: tradeIn,
    status: 'new',
    assignedTo: null,
    notes: [],
    bookingId: null,
    createdAt: now,
    createdBy: PUBLIC_ACTOR,
    updatedAt: now,
    updatedBy: PUBLIC_ACTOR,
    deletedAt: null,
  });
  await sendEnquiryEmails({ id: ref.id, type: input.type, carTitle, customer: input.customer, message: input.message, tradeInVehicle: tradeIn });
  return { enquiryId: ref.id };
}, { secrets: bindSecrets('TURNSTILE_SECRET_KEY', 'RESEND_API_KEY') });
