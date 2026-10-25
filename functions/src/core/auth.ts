/** Role checks from custom claims (`role: 'admin' | 'staff'`). Staff-level access also admits admins. */
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { Role } from '@sda/shared';
import { HttpsError } from './errors';

export interface Caller {
  uid: string;
  role: Role;
  email?: string;
}

export function roleOf(token: Record<string, unknown> | undefined): Role | null {
  const r = token?.role;
  return r === 'admin' || r === 'staff' ? r : null;
}

export function hasAccess(role: Role | null, required: 'public' | 'staff' | 'admin'): boolean {
  if (required === 'public') return true;
  if (required === 'staff') return role === 'staff' || role === 'admin';
  return role === 'admin';
}

/** Throws unauthenticated / permission-denied. Returns the caller for staff/admin access. */
export function requireRole(request: Pick<CallableRequest, 'auth'>, required: 'staff' | 'admin'): Caller {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const role = roleOf(request.auth.token as Record<string, unknown>);
  if (!hasAccess(role, required)) throw new HttpsError('permission-denied', 'You do not have access to this action');
  return { uid: request.auth.uid, role: role!, email: request.auth.token.email };
}
