/**
 * Car image URLs.
 *   carImageUrl('local:cars/car-01.webp')        → /images/cars/car-01.webp   (seed/dev files in public/images)
 *   carImageUrl('<cloudflare-id>', 'thumb')      → ${VITE_CF_IMAGES_DELIVERY_URL}/<id>/thumb
 * Variants: thumb (400w), card (800w), full (1600w).
 *
 * With <Img> (@/components/img), pass the URL from carImageUrl(id, 'full') as `src` and set `sizes`;
 * `imageSrcSet` turns a Cloudflare delivery URL into a srcset over all three variants.
 */
import {
  coverImage,
  type CarImage,
  type ImageVariant,
  isLocalImageId,
  resolveImageUrl,
  sortCarImages,
} from '@sda/shared';
import { publicEnv } from './env';

export { isLocalImageId, sortCarImages };
export type { ImageVariant };

export function carImageUrl(id: string, variant: ImageVariant = 'card'): string {
  return resolveImageUrl(id, variant, { deliveryUrl: publicEnv.cfImagesDeliveryUrl, localBase: '/images' });
}

/** Absolute URL (Open Graph, schema.org, emails). */
export function absoluteCarImageUrl(id: string, variant: ImageVariant = 'full'): string {
  const url = carImageUrl(id, variant);
  return url.startsWith('http') ? url : `${publicEnv.siteUrl}${url}`;
}

/** Cover image URL for a car, or the placeholder. */
export function carCoverUrl(images: readonly CarImage[] | undefined | null, variant: ImageVariant = 'card'): string {
  const cover = images?.length ? coverImage(images) : undefined;
  return cover ? carImageUrl(cover.id, variant) : '/placeholder-car.svg';
}

const VARIANT_WIDTHS: [variant: ImageVariant, width: number][] = [
  ['thumb', 400],
  ['card', 800],
  ['full', 1600],
];
const DELIVERY = /^(https:\/\/imagedelivery\.net\/[^/]+\/.+)\/(thumb|card|full|public)$/;

/** srcset for a Cloudflare Images delivery URL (all variants); undefined for local/static files. */
export function imageSrcSet(src: string): string | undefined {
  const m = DELIVERY.exec(src);
  return m ? VARIANT_WIDTHS.map(([v, w]) => `${m[1]}/${v} ${w}w`).join(', ') : undefined;
}
