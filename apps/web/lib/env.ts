/**
 * Public (VITE_*) config, inlined by Vite at build time. Everything here ships to the browser.
 */
const env = import.meta.env;

export const publicEnv = {
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-solid-drive.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-solid-drive',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-solid-drive.appspot.com',
    appId: env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000',
  },
  useEmulators: env.VITE_USE_EMULATORS === 'true',
  functionsRegion: env.VITE_FUNCTIONS_REGION || 'australia-southeast1',
  appCheckSiteKey: env.VITE_APPCHECK_SITE_KEY || '',
  /** Cloudflare "always passes" test key by default. */
  turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
  cfImagesDeliveryUrl: env.VITE_CF_IMAGES_DELIVERY_URL || '',
  siteUrl: (env.VITE_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
} as const;
