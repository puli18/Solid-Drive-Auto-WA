/** Admin image URLs: demo uploads are data:/blob: URLs; everything else goes through lib/images. */
import { type CarImage, sortCarImages } from '@sda/shared';
import { carImageUrl } from '@/lib/images';

export function adminImageSrc(id: string, variant: 'thumb' | 'card' | 'full' = 'thumb'): string {
  if (id.startsWith('data:') || id.startsWith('blob:')) return id;
  return carImageUrl(id, variant);
}

export function coverSrc(images: readonly CarImage[] | undefined, variant: 'thumb' | 'card' | 'full' = 'thumb'): string | null {
  const first = images?.length ? sortCarImages(images)[0] : undefined;
  return first ? adminImageSrc(first.id, variant) : null;
}
