import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile, TURNSTILE_DUMMY_TOKEN, TURNSTILE_TEST_SECRETS } from '../src/core/turnstile';
import { hasAccess, roleOf } from '../src/core/auth';
import { diffFields } from '../src/core/audit-diff';

afterEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.RESEND_API_KEY;
});

describe('turnstile', () => {
  it('falls back to the always-pass test secret without network', async () => {
    const fetchSpy = vi.fn();
    const r = await verifyTurnstile(TURNSTILE_DUMMY_TOKEN, undefined, fetchSpy as never);
    expect(r).toMatchObject({ success: true, test: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('fails with the always-fail test secret and with no token', async () => {
    process.env.TURNSTILE_SECRET_KEY = TURNSTILE_TEST_SECRETS.alwaysFail;
    expect((await verifyTurnstile('t')).success).toBe(false);
    expect((await verifyTurnstile(undefined)).success).toBe(false);
  });
  it('calls siteverify with a real secret', async () => {
    process.env.TURNSTILE_SECRET_KEY = '0x-real-secret';
    const fetchSpy = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
    const r = await verifyTurnstile('tok', '1.2.3.4', fetchSpy as never);
    expect(r.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe('email', () => {
  it('logs instead of sending when RESEND_API_KEY is missing', async () => {
    const { sendEmail } = await import('../src/core/email');
    const r = await sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>', tag: 'test' });
    expect(r).toEqual({ id: null, logged: true });
  });
});

describe('roles and audit diff', () => {
  it('checks role access (staff level admits admin)', () => {
    expect(roleOf({ role: 'admin' })).toBe('admin');
    expect(roleOf({ role: 'owner' })).toBeNull();
    expect(hasAccess('admin', 'staff')).toBe(true);
    expect(hasAccess('staff', 'admin')).toBe(false);
    expect(hasAccess(null, 'public')).toBe(true);
  });
  it('diffs only changed fields', () => {
    expect(diffFields({ a: 1, b: 2, updatedAt: 1 }, { a: 1, b: 3, updatedAt: 2 })).toEqual({
      before: { b: 2 },
      after: { b: 3 },
    });
  });
});
