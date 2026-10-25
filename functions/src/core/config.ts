/**
 * Runtime configuration.
 * - Region / runtime options shared by every function.
 * - Secrets: declared with defineSecret so deploys can bind them (`secrets: [SECRETS.STRIPE_SECRET_KEY]`),
 *   but always READ through `env()` which falls back to process.env (emulator: functions/.env.local)
 *   and to '' – so a missing key degrades gracefully instead of crashing.
 */
import { defineSecret } from 'firebase-functions/params';
import { REGION } from '@sda/shared';

export { REGION };

export const SECRET_NAMES = [
  'TURNSTILE_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CF_IMAGES_API_TOKEN',
  'CF_CACHE_PURGE_TOKEN',
  'STOCK_FEED_KEY',
] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

export const SECRETS = Object.fromEntries(SECRET_NAMES.map((n) => [n, defineSecret(n)])) as Record<
  SecretName,
  ReturnType<typeof defineSecret>
>;

/** Plain (non-secret) env vars, set in functions/.env.<project>. */
export type EnvName =
  | SecretName
  | 'EMAIL_FROM'
  | 'DEALERSHIP_NOTIFY_EMAIL'
  | 'CF_ACCOUNT_ID'
  | 'CF_ZONE_ID'
  | 'SITE_URL'
  | 'CF_IMAGES_DELIVERY_URL'
  | 'ENFORCE_APP_CHECK';

/** Values treated as "not set" (Secret Manager can't hold an empty secret, so use `unset` as a placeholder). */
const UNSET = new Set(['', 'unset', 'UNSET', '-']);

export function env(name: EnvName, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || UNSET.has(v.trim()) ? fallback : v;
}

/**
 * Secrets to bind on a function (deployed only). The emulator reads them from functions/.env.local /
 * .secret.local instead, so nothing is bound there (a demo- project has no Secret Manager).
 */
export function bindSecrets(...names: SecretName[]): ReturnType<typeof defineSecret>[] {
  return process.env.FUNCTIONS_EMULATOR === 'true' ? [] : names.map((n) => SECRETS[n]);
}

/** App Check enforcement for callables: on in deployed environments unless ENFORCE_APP_CHECK=false. */
export const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true' && env('ENFORCE_APP_CHECK', 'true') !== 'false';

export const siteUrl = () => env('SITE_URL', 'http://localhost:3000').replace(/\/$/, '');
export const emailFrom = () => env('EMAIL_FROM', 'Solid Drive Auto WA <onboarding@resend.dev>');
export const notifyEmail = () => env('DEALERSHIP_NOTIFY_EMAIL', 'sales@soliddrive.test');
