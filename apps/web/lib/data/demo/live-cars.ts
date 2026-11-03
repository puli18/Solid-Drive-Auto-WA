/**
 * Demo mode with a live Firebase config (DEMO_LIVE_CARS): loads the published cars from Firestore once per
 * page session into the demo store's read-only base layer, so the demo admin and the simulated actions
 * (bookings, enquiries, reserve) see the same cars as the public site. READ ONLY: admin edits in demo mode
 * still land in the localStorage overlay and never reach Firestore. Unpublished cars are not readable
 * without auth, so the demo admin only lists published ones.
 */
import { DEMO_LIVE_CARS } from '../mode';
import { loadPublishedCarRows } from '../public';
import { setDemoLiveCars } from './store';

let loading: Promise<void> | null = null;

/** Resolves once the live cars are in the demo store (no-op without a live config). Never rejects. */
export function ensureDemoLiveCars(): Promise<void> {
  if (!DEMO_LIVE_CARS) return Promise.resolve();
  loading ??= loadPublishedCarRows()
    .then((rows) => setDemoLiveCars(rows as { id: string }[]))
    .catch((err: unknown) => {
      loading = null; // retry on the next call
      console.warn('[demo] Could not load cars from Firestore; showing none.', err);
    });
  return loading;
}
