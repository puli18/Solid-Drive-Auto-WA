/**
 * Saves a generated file to Firebase Storage and returns a short-lived URL.
 * Deployed: V4 signed URL (needs the runtime service account to have iam.serviceAccounts.signBlob).
 * Emulator: signing needs real credentials, so it falls back to a download-token URL on the emulator.
 */
import { randomUUID } from 'node:crypto';
import { logger } from 'firebase-functions/v2';
import { bucket, isEmulator } from './admin';

export interface SavedFile {
  url: string;
  expiresAt: string;
  path: string;
}

export async function saveAndSign(
  path: string,
  data: Buffer | string,
  contentType: string,
  ttlMinutes: number,
  downloadName: string = path.split('/').pop() ?? 'download',
): Promise<SavedFile> {
  const b = bucket();
  const file = b.file(path);
  const token = randomUUID();
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST;
  const useEmulator = isEmulator || !!storageHost;
  await file.save(typeof data === 'string' ? Buffer.from(data, 'utf8') : data, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=0, no-store',
      contentDisposition: `attachment; filename="${downloadName.replace(/"/g, '')}"`,
      metadata: useEmulator ? { firebaseStorageDownloadTokens: token } : {},
    },
  });
  const expires = new Date(Date.now() + ttlMinutes * 60_000);
  if (useEmulator) {
    const host = (storageHost ?? '127.0.0.1:9209').replace(/^https?:\/\//, '');
    const url = `http://${host}/v0/b/${b.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    return { url, expiresAt: expires.toISOString(), path };
  }
  try {
    const [url] = await file.getSignedUrl({ version: 'v4', action: 'read', expires });
    return { url, expiresAt: expires.toISOString(), path };
  } catch (err) {
    logger.error('Signing the export URL failed (does the service account have Service Account Token Creator?)', err);
    throw err;
  }
}
