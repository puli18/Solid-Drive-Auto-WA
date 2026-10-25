/**
 * Image id → URL resolution shared by web (and functions for emails/feeds).
 * - `local:cars/car-01.webp` → `/images/cars/car-01.webp` (seed / dev assets in apps/web/public/images)
 * - any other id → `${deliveryUrl}/${id}/${variant}` (Cloudflare Images delivery URL, variants thumb/card/full)
 */
import { type ImageVariant, LOCAL_IMAGE_PREFIX } from './constants';

export function isLocalImageId(id: string): boolean {
  return id.startsWith(LOCAL_IMAGE_PREFIX);
}

export interface ImageUrlOptions {
  /** e.g. https://imagedelivery.net/<account_hash> (NEXT_PUBLIC_CF_IMAGES_DELIVERY_URL) */
  deliveryUrl?: string | null;
  /** Prefix for local images; default "/images". Use an absolute origin for emails. */
  localBase?: string;
}

export function resolveImageUrl(
  id: string,
  variant: ImageVariant = 'card',
  opts: ImageUrlOptions = {},
): string {
  if (/^https?:\/\//.test(id) || id.startsWith('/')) return id;
  if (isLocalImageId(id)) {
    const base = (opts.localBase ?? '/images').replace(/\/$/, '');
    return `${base}/${id.slice(LOCAL_IMAGE_PREFIX.length).replace(/^\//, '')}`;
  }
  const delivery = (opts.deliveryUrl ?? '').replace(/\/$/, '');
  if (!delivery) {
    // No delivery URL configured (local dev) – fall back to a neutral placeholder path.
    return `/placeholder-car.svg`;
  }
  return `${delivery}/${encodeURIComponent(id).replace(/%2F/g, '/')}/${variant}`;
}

/** Cover image first, then by `order`. */
export function sortCarImages<T extends { order: number; isCover?: boolean }>(
  images: readonly T[],
): T[] {
  return [...images].sort((a, b) => Number(!!b.isCover) - Number(!!a.isCover) || a.order - b.order);
}

export function coverImage<T extends { order: number; isCover?: boolean }>(
  images: readonly T[],
): T | undefined {
  return sortCarImages(images)[0];
}
