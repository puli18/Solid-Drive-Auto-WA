// Must run before any functions module is imported (admin SDK + config read env at import time).
const PROJECT = 'demo-solid-drive';
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = PROJECT;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com` });
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8188';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9109';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9209';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_emulator_secret';
process.env.STRIPE_SECRET_KEY = '';
process.env.RESEND_API_KEY = '';
process.env.TURNSTILE_SECRET_KEY = '';
process.env.SITE_URL = 'http://localhost:3000';
