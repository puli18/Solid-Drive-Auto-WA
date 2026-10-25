import { COLLECTIONS, SYSTEM_ACTOR } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import type Stripe from 'stripe';
import { bindSecrets, db, env, FieldValue, REGION, writeAudit } from '../core';
import { stripeWebhooks } from '../core/stripe';
import { carLite } from '../bookings/logic';
import { sendDepositConflictEmail, sendDepositPaidEmails, type DepositForEmail } from '../notify/deposits';

export type WebhookOutcome =
  | 'duplicate'
  | 'paid'
  | 'conflict'
  | 'expired'
  | 'ignored'
  | 'already-final'
  | 'deposit-not-found'
  | 'awaiting-payment';

const paymentIntentId = (s: Stripe.Checkout.Session) =>
  typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null);

/**
 * Applies one (already verified) Stripe event. Idempotent: `stripeEvents/{event.id}` is written in the
 * same transaction as the deposit/car changes, so a replayed event is a no-op ("duplicate").
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<{ outcome: WebhookOutcome; depositId?: string }> {
  const eventRef = db.collection(COLLECTIONS.stripeEvents).doc(event.id);
  const marker = (outcome: WebhookOutcome, depositId?: string) => ({
    type: event.type,
    outcome,
    depositId: depositId ?? null,
    livemode: event.livemode,
    created: event.created,
    processedAt: FieldValue.serverTimestamp(),
  });

  const isCompleted = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const isExpired = event.type === 'checkout.session.expired';
  if (!isCompleted && !isExpired) {
    const r = await db.runTransaction(async (tx) => {
      if ((await tx.get(eventRef)).exists) return 'duplicate' as const;
      tx.set(eventRef, marker('ignored'));
      return 'ignored' as const;
    });
    return { outcome: r };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const depositId = session.metadata?.depositId || session.client_reference_id || '';
  let email: { kind: 'paid' | 'conflict'; data: DepositForEmail } | null = null;

  const outcome = await db.runTransaction(async (tx): Promise<WebhookOutcome> => {
    email = null;
    const evSnap = await tx.get(eventRef);
    if (evSnap.exists) return 'duplicate';
    const depRef = db.collection(COLLECTIONS.deposits).doc(depositId || '_missing_');
    const depSnap = depositId ? await tx.get(depRef) : null;
    if (!depSnap?.exists) {
      tx.set(eventRef, marker('deposit-not-found', depositId));
      return 'deposit-not-found';
    }
    const dep = depSnap.data()!;
    const now = FieldValue.serverTimestamp();

    if (isExpired) {
      if (dep.status !== 'pending') {
        tx.set(eventRef, marker('already-final', depositId));
        return 'already-final';
      }
      tx.update(depRef, { status: 'expired', expiredAt: now, updatedAt: now, updatedBy: SYSTEM_ACTOR });
      await writeAudit(
        { actorUid: SYSTEM_ACTOR, action: 'deposit-expired', entity: 'deposit', entityId: depositId, carId: String(dep.carId), before: { status: dep.status }, after: { status: 'expired' } },
        tx,
      );
      tx.set(eventRef, marker('expired', depositId));
      return 'expired';
    }

    // Completed.
    if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') {
      // Delayed payment methods: wait for checkout.session.async_payment_succeeded.
      tx.set(eventRef, marker('awaiting-payment', depositId));
      return 'awaiting-payment';
    }
    if (dep.status === 'paid' || dep.status === 'conflict') {
      tx.set(eventRef, marker('already-final', depositId));
      return 'already-final';
    }
    if (session.amount_total != null && session.amount_total !== dep.amountCents) {
      logger.error('Deposit amount mismatch', { depositId, expected: dep.amountCents, got: session.amount_total });
    }
    const carRef = db.collection(COLLECTIONS.cars).doc(String(dep.carId));
    const car = carLite(await tx.get(carRef));
    const pi = paymentIntentId(session);
    const paidAt = new Date();
    const forEmail: DepositForEmail = {
      id: depositId,
      carTitle: String(dep.carTitle ?? car?.title ?? ''),
      carSlug: car?.slug ?? null,
      stockNo: String(dep.stockNo ?? car?.stockNo ?? ''),
      amountCents: Number(dep.amountCents),
      customer: dep.customer,
      paidAt,
      sessionId: session.id,
      paymentIntentId: pi,
      carStatus: car ? (car.deleted ? 'deleted' : car.status) : 'missing',
    };
    const common = { paidAt, stripePaymentIntentId: pi, stripeSessionId: session.id, updatedAt: now, updatedBy: SYSTEM_ACTOR };

    if (car && !car.deleted && car.status === 'available') {
      tx.update(carRef, { status: 'reserved', reservedAt: now, updatedAt: now, updatedBy: SYSTEM_ACTOR });
      tx.update(depRef, { ...common, status: 'paid' });
      await writeAudit(
        { actorUid: SYSTEM_ACTOR, action: 'deposit-paid', entity: 'deposit', entityId: depositId, carId: car.id, before: { status: dep.status }, after: { status: 'paid', carStatus: 'reserved' } },
        tx,
      );
      tx.set(eventRef, marker('paid', depositId));
      email = { kind: 'paid', data: forEmail };
      return 'paid';
    }
    tx.update(depRef, { ...common, status: 'conflict' });
    await writeAudit(
      { actorUid: SYSTEM_ACTOR, action: 'deposit-conflict', entity: 'deposit', entityId: depositId, carId: String(dep.carId), before: { status: dep.status }, after: { status: 'conflict', carStatus: forEmail.carStatus } },
      tx,
    );
    tx.set(eventRef, marker('conflict', depositId));
    email = { kind: 'conflict', data: forEmail };
    return 'conflict';
  });

  const mail = email as { kind: 'paid' | 'conflict'; data: DepositForEmail } | null;
  if (mail?.kind === 'paid') await sendDepositPaidEmails(mail.data);
  if (mail?.kind === 'conflict') await sendDepositConflictEmail(mail.data);
  return { outcome, depositId };
}

/**
 * Stripe webhook (HTTPS). Verifies the signature against the raw body with STRIPE_WEBHOOK_SECRET, then
 * handles checkout.session.completed / async_payment_succeeded (reserve or conflict) and
 * checkout.session.expired. Responds 5xx on processing errors so Stripe retries (nothing was committed).
 */
export const stripeWebhook = onRequest(
  { region: REGION, secrets: bindSecrets('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY') },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST').status(405).json({ error: 'Method not allowed' });
      return;
    }
    const secret = env('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      logger.error('[stripe:not-configured] STRIPE_WEBHOOK_SECRET is not set – rejecting webhook');
      res.status(503).json({ error: 'Webhook not configured' });
      return;
    }
    const signature = req.header('stripe-signature');
    let event: Stripe.Event;
    try {
      if (!signature) throw new Error('Missing Stripe-Signature header');
      event = stripeWebhooks().constructEvent(req.rawBody, signature, secret);
    } catch (err) {
      logger.warn('Stripe signature verification failed', { message: (err as Error).message });
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
    try {
      const r = await handleStripeEvent(event);
      logger.info(`Stripe ${event.type} ${event.id}: ${r.outcome}`, r);
      res.status(200).json({ received: true, outcome: r.outcome });
    } catch (err) {
      logger.error(`Stripe event ${event.id} failed`, err);
      res.status(500).json({ error: 'Processing failed' });
    }
  },
);
