/** Manage-link tokens: the raw token is emailed; only its SHA-256 hash is stored on the booking. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function newManageToken(): string {
  return randomBytes(24).toString('base64url'); // 32 chars
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time check of a raw token against a stored hash. */
export function tokenMatches(token: string, storedHash: string | undefined | null): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Constant-time string compare (feed keys etc.). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
