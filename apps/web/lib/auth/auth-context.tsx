/**
 * Auth context for the admin dashboard. Role comes from the `role` custom claim (admin | staff),
 * or – in demo mode (VITE_DEMO_MODE=true) – from the demo accounts in @sda/shared/demo
 * (DEMO_ACCOUNTS; show them on the login screen). The demo session lives in localStorage.
 *
 *   // app/admin/layout.tsx
 *   <AuthProvider>{children}</AuthProvider>
 *   // any client component under it
 *   const { user, role, isAdmin, isStaff, loading, signIn, signOut, demo, switchDemoRole } = useAuth();
 *   <RoleGate allow="admin">…admin-only UI…</RoleGate>
 *
 * A signed-in user WITHOUT a role claim (deactivated / not invited) has role = null and must be treated
 * as signed out by the admin shell. Claims refresh on every ID-token refresh (≤ 1 h) or `refreshClaims()`.
 * `firebaseUser` exposes the raw Firebase user (MFA enrolment etc.) – null in demo mode.
 */
import type { Role } from '@sda/shared/constants';
import { DEMO_ACCOUNTS } from '@sda/shared/demo';
import {
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_MODE } from '../data/mode';
import { getFirebaseAuth } from '../firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  firebaseUser: User | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  /** true for staff AND admin (staff-level access). */
  isStaff: boolean;
  /** true when running on demo data (preview deploy). */
  demo: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Force-refresh the ID token to pick up new custom claims. */
  refreshClaims(): Promise<Role | null>;
  /** Demo mode only: switch the signed-in demo account between admin and staff. */
  switchDemoRole(role: Role): void;
}

const AuthContext = createContext<AuthState | null>(null);
const DEMO_SESSION_KEY = 'sda-demo-session';

function roleFromClaims(claims: Record<string, unknown>): Role | null {
  return claims.role === 'admin' || claims.role === 'staff' ? claims.role : null;
}

function demoUser(role: Role): AuthUser {
  const a = DEMO_ACCOUNTS[role];
  return { uid: a.uid, email: a.email, displayName: a.name };
}

function readDemoSession(): Role | null {
  try {
    const r = window.localStorage.getItem(DEMO_SESSION_KEY);
    return r === 'admin' || r === 'staff' ? r : null;
  } catch {
    return null;
  }
}
function writeDemoSession(role: Role | null) {
  try {
    if (role) window.localStorage.setItem(DEMO_SESSION_KEY, role);
    else window.localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEMO_MODE) {
      const r = readDemoSession();
      setRole(r);
      setUser(r ? demoUser(r) : null);
      setLoading(false);
      return;
    }
    return onIdTokenChanged(getFirebaseAuth(), async (u) => {
      setFirebaseUser(u);
      setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null);
      setRole(u ? roleFromClaims((await u.getIdTokenResult()).claims) : null);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      const acct = Object.values(DEMO_ACCOUNTS).find(
        (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password,
      );
      if (!acct) throw new Error('Use one of the demo accounts shown on this page.');
      writeDemoSession(acct.role);
      setRole(acct.role);
      setUser(demoUser(acct.role));
      return;
    }
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      writeDemoSession(null);
      setRole(null);
      setUser(null);
      return;
    }
    await fbSignOut(getFirebaseAuth());
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (DEMO_MODE) return;
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const refreshClaims = useCallback(async () => {
    if (DEMO_MODE) return readDemoSession();
    const u = getFirebaseAuth().currentUser;
    if (!u) return null;
    const r = roleFromClaims((await u.getIdTokenResult(true)).claims);
    setRole(r);
    return r;
  }, []);

  const switchDemoRole = useCallback((r: Role) => {
    if (!DEMO_MODE) return;
    writeDemoSession(r);
    setRole(r);
    setUser(demoUser(r));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      firebaseUser,
      role,
      loading,
      isAdmin: role === 'admin',
      isStaff: role === 'admin' || role === 'staff',
      demo: DEMO_MODE,
      signIn,
      signOut,
      sendPasswordReset,
      refreshClaims,
      switchDemoRole,
    }),
    [user, firebaseUser, role, loading, signIn, signOut, sendPasswordReset, refreshClaims, switchDemoRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Renders children only for the allowed role ('staff' admits admins too). */
export function RoleGate({ allow, children, fallback = null }: { allow: Role; children: ReactNode; fallback?: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return null;
  const ok = allow === 'admin' ? role === 'admin' : role === 'admin' || role === 'staff';
  return <>{ok ? children : fallback}</>;
}
