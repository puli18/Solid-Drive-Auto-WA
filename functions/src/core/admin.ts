/** Firebase Admin SDK singletons. Import `db`, `auth`, `bucket` from here – never call initializeApp elsewhere. */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const app = getApps()[0] ?? initializeApp();

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth(app);
export const storage = getStorage(app);
export const bucket = () => storage.bucket();
export { FieldValue, Timestamp };

export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
