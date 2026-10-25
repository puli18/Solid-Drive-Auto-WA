import { COLLECTIONS } from '@sda/shared';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/core/admin';
import { createDepositCheckout } from '../../src/deposits/createDepositCheckout';
import { getDepositStatus } from '../../src/deposits/getDepositStatus';
import { handleStripeEvent, stripeWebhook } from '../../src/deposits/stripeWebhook';
import { callReq, count, resetFirestore, seedCar, seedSettings, TOKEN } from './helpers';

const customer = (i: number) => ({ name: `Buyer ${i}`, phone: '0411 555 20' + i, email: `buyer${i}@example.com` });

async function checkout(carId: string, i: number) {
  return createDepositCheckout.run(
    callReq({ carId, customer: customer(i), termsAccepted: true, termsVersion: 'v-test', turnstileToken: TOKEN }),
  );
}

let seq = 0;
function sessionEvent(type: string, depositId: string, carId: string, opts: { id?: string; paid?: boolean } = {}): Stripe.Event {
  seq++;
  return {
    id: opts.id ?? `evt_test_${Date.now()}_${seq}`,
    object: 'event',
    type,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_dev_${depositId}`,
        object: 'checkout.session',
        metadata: { depositId, carId },
        client_reference_id: depositId,
        payment_status: opts.paid === false ? 'unpaid' : 'paid',
        payment_intent: `pi_test_${seq}`,
        amount_total: 50_000,
        currency: 'aud',
      },
    },
  } as unknown as Stripe.Event;
}

beforeEach(async () => {
  await resetFirestore();
  await seedSettings();
  await seedCar('car-d');
});

describe('createDepositCheckout (no Stripe key → no charge)', () => {
  it('creates a pending deposit with the exact settings amount and terms version', async () => {
    const r = await checkout('car-d', 1);
    expect(r.url).toContain('/reserve/success?session_id=cs_dev_');
    const dep = (await db.doc(`deposits/${r.depositId}`).get()).data()!;
    expect(dep).toMatchObject({ status: 'pending', amountCents: 50_000, termsVersion: 'v-test', carId: 'car-d' });
    expect(dep.termsAcceptedAt).toBeTruthy();
    const status = await getDepositStatus.run(callReq({ sessionId: dep.stripeSessionId }));
    expect(status).toMatchObject({ status: 'pending', amountCents: 50_000 });
  });

  it('rejects stale terms and unavailable cars', async () => {
    await expect(
      createDepositCheckout.run(callReq({ carId: 'car-d', customer: customer(1), termsAccepted: true, termsVersion: 'old', turnstileToken: TOKEN })),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await db.doc('cars/car-d').update({ status: 'reserved' });
    await expect(checkout('car-d', 1)).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('stripeWebhook', () => {
  it('completed → car reserved + deposit paid; replaying the event changes nothing', async () => {
    const { depositId } = await checkout('car-d', 1);
    const ev = sessionEvent('checkout.session.completed', depositId, 'car-d');
    expect((await handleStripeEvent(ev)).outcome).toBe('paid');
    const snapshot = async () => ({
      car: (await db.doc('cars/car-d').get()).data(),
      dep: (await db.doc(`deposits/${depositId}`).get()).data(),
      audit: await count(COLLECTIONS.auditLog),
      events: await count(COLLECTIONS.stripeEvents),
    });
    const first = await snapshot();
    expect(first.car!.status).toBe('reserved');
    expect(first.dep!.status).toBe('paid');
    expect((await handleStripeEvent(ev)).outcome).toBe('duplicate');
    expect((await handleStripeEvent(ev)).outcome).toBe('duplicate');
    expect(await snapshot()).toEqual(first);
    expect((await getDepositStatus.run(callReq({ sessionId: `cs_dev_${depositId}` }))).status).toBe('paid');
  });

  it('two near-simultaneous payments → one reserved, one conflict', async () => {
    const a = await checkout('car-d', 1);
    const b = await checkout('car-d', 2);
    const results = await Promise.all([
      handleStripeEvent(sessionEvent('checkout.session.completed', a.depositId, 'car-d')),
      handleStripeEvent(sessionEvent('checkout.session.completed', b.depositId, 'car-d')),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual(['conflict', 'paid']);
    const statuses = await Promise.all([a, b].map(async (x) => (await db.doc(`deposits/${x.depositId}`).get()).data()!.status));
    expect(statuses.sort()).toEqual(['conflict', 'paid']);
    expect((await db.doc('cars/car-d').get()).data()!.status).toBe('reserved');
  });

  it('expired → deposit expired (car untouched); unpaid completion waits', async () => {
    const { depositId } = await checkout('car-d', 1);
    expect((await handleStripeEvent(sessionEvent('checkout.session.completed', depositId, 'car-d', { paid: false }))).outcome).toBe(
      'awaiting-payment',
    );
    expect((await handleStripeEvent(sessionEvent('checkout.session.expired', depositId, 'car-d'))).outcome).toBe('expired');
    expect((await db.doc(`deposits/${depositId}`).get()).data()!.status).toBe('expired');
    expect((await db.doc('cars/car-d').get()).data()!.status).toBe('available');
  });

  it('HTTP handler verifies the Stripe signature', async () => {
    const { depositId } = await checkout('car-d', 1);
    const ev = sessionEvent('checkout.session.completed', depositId, 'car-d');
    const payload = JSON.stringify(ev);
    const stripe = new Stripe('sk_test_dummy');
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    const call = async (sig: string) => {
      const res: { code?: number; body?: unknown } = {};
      const r = {
        status(c: number) { res.code = c; return r; },
        json(b: unknown) { res.body = b; return r; },
        set() { return r; },
      };
      const req = { method: 'POST', rawBody: Buffer.from(payload), header: (n: string) => (n.toLowerCase() === 'stripe-signature' ? sig : undefined) };
      await (stripeWebhook as unknown as (q: unknown, s: unknown) => Promise<void>)(req, r);
      return res;
    };
    expect((await call('t=1,v1=bad')).code).toBe(400);
    expect((await db.doc(`deposits/${depositId}`).get()).data()!.status).toBe('pending');
    const ok = await call(header);
    expect(ok.code).toBe(200);
    expect(ok.body).toMatchObject({ outcome: 'paid' });
    expect((await call(header)).body).toMatchObject({ outcome: 'duplicate' });
  });
});
