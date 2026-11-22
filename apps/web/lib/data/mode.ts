/**
 * Data-source switch. VITE_DEMO_MODE=true → bundled demo data (users, settings, bookings, enquiries…:
 * client preview deploy, no Cloud Functions or Auth needed). Never enable in production (vite.config.ts
 * refuses to build that combination).
 *
 * Cars are never bundled. In demo mode they are read from the live Firestore project (public reads of
 * published cars only, never written) when a real Firebase config is given: VITE_FIREBASE_PROJECT_ID set
 * and not a `demo-` (emulator) id, and VITE_USE_EMULATORS not true. Otherwise demo mode has no cars.
 */
const env = import.meta.env;

export const DEMO_MODE = env.VITE_DEMO_MODE === 'true';
export type DataMode = 'firebase' | 'demo';
export const DATA_MODE: DataMode = DEMO_MODE ? 'demo' : 'firebase';

const projectId = env.VITE_FIREBASE_PROJECT_ID ?? '';
/** Demo mode reading its cars from the live Firestore project. */
export const DEMO_LIVE_CARS = DEMO_MODE && projectId !== '' && !projectId.startsWith('demo-') && env.VITE_USE_EMULATORS !== 'true';
/** Whether cars come from Firestore at all (Firebase mode, or demo mode with a live project). */
export const CARS_FROM_FIRESTORE = !DEMO_MODE || DEMO_LIVE_CARS;

/**
 * Whether search engines may index this build. Demo builds stay hidden unless VITE_ALLOW_INDEXING=true:
 * the public domain currently serves the demo build (no Cloud Functions yet), and it must be found on Google.
 * Cloudflare's *.pages.dev hosts are kept out of the index by host rules in public/_headers.
 */
export const INDEXABLE = !DEMO_MODE || env.VITE_ALLOW_INDEXING === 'true';

/** True when the page is served from VITE_SITE_URL's host (www. ignored), i.e. the real domain, not pages.dev. */
export const ON_SITE_DOMAIN = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const strip = (h: string) => h.replace(/^www\./, '');
    return strip(new URL(env.VITE_SITE_URL || 'http://localhost:3000').hostname) === strip(window.location.hostname);
  } catch {
    return false;
  }
})();

/**
 * Demo build on the real domain: the forms can't deliver anything until Cloud Functions are live, so they show
 * the phone number instead. The pages.dev client preview keeps the working demo forms.
 */
export const FORMS_OFFLINE = DEMO_MODE && ON_SITE_DOMAIN;
