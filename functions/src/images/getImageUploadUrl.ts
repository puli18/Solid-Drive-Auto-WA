import { MAX_CAR_PHOTOS, COLLECTIONS } from '@sda/shared';
import { db, defineCallable, HttpsError, bindSecrets } from '../core';
import { createDirectUpload } from '../core/cloudflare';

/**
 * getImageUploadUrl (staff, admin) – one Cloudflare Images direct creator upload URL for a car photo.
 * The client uploads the file straight to Cloudflare, then adds `{ id: imageId }` to car.images.
 */
export const getImageUploadUrl = defineCallable('getImageUploadUrl', async (input, ctx) => {
  if (input.carId) {
    const snap = await db.collection(COLLECTIONS.cars).doc(input.carId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Car not found');
    if (((snap.data()!.images as unknown[]) ?? []).length >= MAX_CAR_PHOTOS) {
      throw new HttpsError('failed-precondition', `A car can have at most ${MAX_CAR_PHOTOS} photos.`);
    }
  }
  return createDirectUpload({ metadata: { kind: 'car', carId: input.carId ?? '', uploadedBy: ctx.uid ?? '' } });
}, { secrets: bindSecrets('CF_IMAGES_API_TOKEN') });
