import { COLLECTIONS, DEPOSIT_CHECKOUT_EXPIRY_MINUTES, formatAUD, PUBLIC_ACTOR } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { assertTurnstile, bindSecrets, db, defineCallable, FieldValue, HttpsError, siteUrl } from '../core';
import { getDepositSettings } from '../core/settings';
import { stripeClient } from '../core/stripe';
import { carLite } from '../bookings/logic';

/** Stripe's custom_text.submit.message limit. */
const CUSTOM_TEXT_MAX = 1200;

/**
 * createDepositCheckout (public, Turnstile) – verifies the car is available and the current terms were
 * accepted, creates a pending `deposits` doc and a Stripe Checkout Session (payment mode, AUD, exactly
 * settings/deposit.amountCents, no surcharge, 30-min expiry, non-refundable terms in the custom text).
 * Without STRIPE_SECRET_KEY nothing is charged: the deposit stays pending and a local "not configured"
 * success URL is returned.
 */
export const createDepositCheckout = defineCallable(
  'createDepositCheckout',
  async (input, ctx) => {
    await assertTurnstile(input.turnstileToken, ctx.ip);
    const settings = await getDepositSettings();
    if (!settings.enabled) throw new HttpsError('failed-precondition', 'Online deposits are not available right now. Please call us.');
    if (input.termsVersion !== settings.termsVersion) {
      throw new HttpsError('failed-precondition', 'The deposit terms have been updated. Please review and accept them again.', {
        termsVersion: settings.termsVersion,
      });
    }
    const car = carLite(await db.collection(COLLECTIONS.cars).doc(input.carId).get());
    if (!car || !car.published || car.deleted || car.status !== 'available') {
      throw new HttpsError('failed-precondition', 'Sorry, this car is no longer available to reserve.');
    }

    const ref = db.collection(COLLECTIONS.deposits).doc();
    const now = FieldValue.serverTimestamp();
    await ref.create({
      carId: car.id,
      carTitle: car.title,
      stockNo: car.stockNo,
      amountCents: settings.amountCents,
      customer: input.customer,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      status: 'pending',
      termsAcceptedAt: now,
      termsVersion: settings.termsVersion,
      paidAt: null,
      createdAt: now,
      createdBy: PUBLIC_ACTOR,
      updatedAt: now,
      updatedBy: PUBLIC_ACTOR,
      deletedAt: null,
    });

    const base = siteUrl();
    const stripe = stripeClient();
    if (!stripe) {
      const sessionId = `cs_dev_${ref.id}`;
      await ref.update({ stripeSessionId: sessionId });
      logger.warn(`[stripe:not-configured] deposit ${ref.id} created without a Checkout Session (no payment taken)`);
      return { depositId: ref.id, url: `${base}/reserve/success?session_id=${sessionId}` };
    }

    const amountLabel = formatAUD(settings.amountCents, { cents: true });
    const terms = `NON-REFUNDABLE DEPOSIT of ${amountLabel}. ${settings.termsText}`;
    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          currency: 'aud',
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'aud',
                unit_amount: settings.amountCents,
                product_data: {
                  name: `Deposit – ${car.title} (${car.stockNo})`,
                  description: 'Non-refundable holding deposit',
                },
              },
            },
          ],
          customer_email: input.customer.email,
          client_reference_id: ref.id,
          metadata: { depositId: ref.id, carId: car.id, termsVersion: settings.termsVersion },
          payment_intent_data: {
            description: `Deposit – ${car.title} (${car.stockNo})`,
            metadata: { depositId: ref.id, carId: car.id },
          },
          // Stripe requires >= 30 min; add a minute so clock skew can't push it under the minimum.
          expires_at: Math.floor(Date.now() / 1000) + DEPOSIT_CHECKOUT_EXPIRY_MINUTES * 60 + 60,
          custom_text: { submit: { message: terms.length > CUSTOM_TEXT_MAX ? `${terms.slice(0, CUSTOM_TEXT_MAX - 1)}…` : terms } },
          success_url: `${base}/reserve/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/reserve/cancelled?car=${encodeURIComponent(car.slug ?? '')}`,
          locale: 'en',
        },
        { idempotencyKey: `deposit-${ref.id}` },
      );
      await ref.update({ stripeSessionId: session.id, updatedAt: FieldValue.serverTimestamp() });
      if (!session.url) throw new Error('Stripe returned no Checkout URL');
      return { depositId: ref.id, url: session.url };
    } catch (err) {
      logger.error('Stripe Checkout Session failed', err);
      await ref.update({ status: 'expired', expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      throw new HttpsError('unavailable', 'Payments are unavailable right now. Please try again shortly.');
    }
  },
  { secrets: bindSecrets('TURNSTILE_SECRET_KEY', 'STRIPE_SECRET_KEY') },
);
