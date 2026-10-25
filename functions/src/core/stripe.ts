/**
 * Stripe client. Test-mode keys until launch. With no STRIPE_SECRET_KEY, `stripeClient()` returns null and
 * callers degrade (deposit checkout returns a local "not configured" URL; nothing is charged).
 */
import Stripe from 'stripe';
import { logger } from 'firebase-functions/v2';
import { env } from './config';
import { isEmulator } from './admin';

let client: Stripe | null = null;
let clientKey = '';

export function stripeClient(): Stripe | null {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return null;
  if (key.startsWith('sk_live_') && isEmulator) {
    logger.error('Refusing to use a LIVE Stripe key in the emulator. Use a test key (sk_test_…).');
    return null;
  }
  if (!client || clientKey !== key) {
    client = new Stripe(key, { appInfo: { name: 'solid-drive-auto-wa' } });
    clientKey = key;
  }
  return client;
}

/** Webhook signature verification only needs the signing secret (no API key / network). */
let verifier: Stripe | null = null;
export function stripeWebhooks(): Stripe['webhooks'] {
  verifier ??= new Stripe(env('STRIPE_SECRET_KEY') || 'sk_test_webhook_verification_only');
  return verifier.webhooks;
}
