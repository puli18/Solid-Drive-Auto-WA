/**
 * Demo / seed fixtures – the ONE source for the bundled demo dataset. Used by `scripts/seed.ts` (emulators)
 * and by the web app's demo adapter (demo mode). The login accounts are test values only.
 *
 * Car data is NOT bundled here: the dealer's stock lives in Firestore and is seeded by
 * `pnpm seed:stock` from `scripts/data/stock.ts` (scripts only, never imported by the app).
 */

/** Demo/seed login accounts (shown on the demo login screen; emulator seed uses the same). */
export const DEMO_ACCOUNTS = {
  admin: { uid: 'demo-admin', email: 'admin@soliddrive.test', password: 'Demo-Admin-2026', name: 'Alex Admin', role: 'admin' },
  staff: { uid: 'demo-staff', email: 'staff@soliddrive.test', password: 'Demo-Staff-2026', name: 'Sam Staff', role: 'staff' },
} as const;
