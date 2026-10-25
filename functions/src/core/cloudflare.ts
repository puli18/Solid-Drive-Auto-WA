/**
 * Cloudflare APIs: Images (direct creator upload URLs, deletes) and cache purge.
 * With no CF_ACCOUNT_ID / tokens the calls are LOGGED instead of made (local dev, emulator).
 */
import { logger } from 'firebase-functions/v2';
import { env } from './config';
import { HttpsError } from './errors';

const API = 'https://api.cloudflare.com/client/v4';

interface CfResponse<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
}

export function imagesConfigured(): boolean {
  return !!(env('CF_ACCOUNT_ID') && env('CF_IMAGES_API_TOKEN'));
}

export interface DirectUpload {
  imageId: string;
  uploadURL: string;
}

/**
 * One-time direct creator upload URL. `customId` (e.g. "trade-in/2026-10-25/<uuid>") puts the image
 * under a prefix; otherwise Cloudflare assigns the id. Expires after 30 minutes.
 */
export async function createDirectUpload(
  opts: { customId?: string; metadata?: Record<string, string> } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<DirectUpload> {
  if (!imagesConfigured()) {
    logger.warn('[cloudflare:not-configured] direct upload requested but CF_ACCOUNT_ID / CF_IMAGES_API_TOKEN are not set', opts);
    throw new HttpsError('failed-precondition', 'Photo uploads are not configured yet. Please try again later.');
  }
  const form = new FormData();
  if (opts.customId) form.set('id', opts.customId);
  form.set('requireSignedURLs', 'false');
  form.set('metadata', JSON.stringify(opts.metadata ?? {}));
  form.set('expiry', new Date(Date.now() + 30 * 60_000).toISOString());
  const res = await fetchImpl(`${API}/accounts/${env('CF_ACCOUNT_ID')}/images/v2/direct_upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('CF_IMAGES_API_TOKEN')}` },
    body: form,
  });
  const json = (await res.json().catch(() => null)) as CfResponse<{ id: string; uploadURL: string }> | null;
  if (!res.ok || !json?.success) {
    logger.error('Cloudflare direct upload failed', { status: res.status, errors: json?.errors });
    throw new HttpsError('unavailable', 'Could not start the photo upload. Please try again.');
  }
  return { imageId: json.result.id, uploadURL: json.result.uploadURL };
}

/** Deletes an image. Returns false when not configured (logged) or Cloudflare says it doesn't exist. */
export async function deleteImage(imageId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!imagesConfigured()) {
    logger.info(`[cloudflare:not-configured] would delete image ${imageId}`);
    return false;
  }
  const res = await fetchImpl(
    `${API}/accounts/${env('CF_ACCOUNT_ID')}/images/v1/${encodeURIComponent(imageId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${env('CF_IMAGES_API_TOKEN')}` } },
  );
  if (res.status === 404) return false;
  if (!res.ok) {
    logger.error('Cloudflare image delete failed', { imageId, status: res.status, body: await res.text().catch(() => '') });
    return false;
  }
  return true;
}

/** Purges URLs from the Cloudflare edge cache (max 30 per call). Logged when not configured. */
export async function purgeCache(urls: string[], fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const unique = [...new Set(urls)];
  if (!unique.length) return true;
  const zone = env('CF_ZONE_ID');
  const token = env('CF_CACHE_PURGE_TOKEN');
  if (!zone || !token) {
    logger.info(`[cloudflare:not-configured] would purge ${unique.length} URL(s)`, { urls: unique });
    return false;
  }
  let ok = true;
  for (let i = 0; i < unique.length; i += 30) {
    const res = await fetchImpl(`${API}/zones/${zone}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: unique.slice(i, i + 30) }),
    });
    if (!res.ok) {
      ok = false;
      logger.error('Cloudflare cache purge failed', { status: res.status, body: await res.text().catch(() => '') });
    }
  }
  return ok;
}
