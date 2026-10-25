import { COLLECTIONS, type GetDepositStatusOutput } from '@sda/shared';
import { db, defineCallable } from '../core';

/** getDepositStatus (public) – status for the /reserve/success page by Checkout Session id (never trust the redirect). */
export const getDepositStatus = defineCallable('getDepositStatus', async (input) => {
  const snap = await db.collection(COLLECTIONS.deposits).where('stripeSessionId', '==', input.sessionId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return { status: 'not-found' } satisfies GetDepositStatusOutput;
  const d = doc.data();
  const car = await db.collection(COLLECTIONS.cars).doc(String(d.carId)).get();
  const c = car.data();
  return {
    status: d.status,
    carTitle: String(d.carTitle ?? ''),
    carSlug: c && c.published ? ((c.slug as string) ?? null) : null,
    amountCents: Number(d.amountCents),
  } satisfies GetDepositStatusOutput;
});
