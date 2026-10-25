/**
 * Cloudflare Turnstile verification.
 * Without TURNSTILE_SECRET_KEY the always-pass TEST secret is used, and test secrets are resolved
 * locally (no network) – so local dev and the emulator work with the test site key's dummy token.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
import { logger } from 'firebase-functions/v2';
import { env } from './config';
import { HttpsError } from './errors';

export const TURNSTILE_TEST_SECRETS = {
  alwaysPass: '1x0000000000000000000000000000000AA',
  alwaysFail: '2x0000000000000000000000000000000AA',
  tokenSpent: '3x0000000000000000000000000000000AA',
} as const;
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
  test: boolean;
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  const secret = env('TURNSTILE_SECRET_KEY') || TURNSTILE_TEST_SECRETS.alwaysPass;
  if (!token) return { success: false, errorCodes: ['missing-input-response'], test: false };

  if (secret === TURNSTILE_TEST_SECRETS.alwaysPass) return { success: true, errorCodes: [], test: true };
  if (secret === TURNSTILE_TEST_SECRETS.alwaysFail || secret === TURNSTILE_TEST_SECRETS.tokenSpent) {
    return { success: false, errorCodes: ['test-secret-fail'], test: true };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const json = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    return { success: !!json.success, errorCodes: json['error-codes'] ?? [], test: false };
  } catch (err) {
    logger.error('Turnstile verification request failed', err);
    return { success: false, errorCodes: ['internal-error'], test: false };
  }
}

/** Throws a `failed-precondition` HttpsError when verification fails. */
export async function assertTurnstile(token: string | undefined, remoteIp?: string): Promise<void> {
  const r = await verifyTurnstile(token, remoteIp);
  if (!r.success) {
    throw new HttpsError('failed-precondition', 'Verification failed. Please try again.', { codes: r.errorCodes });
  }
}
