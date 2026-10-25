import { COLLECTIONS, isLocalImageId, type CarImage } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { db, defineCallable, FieldValue, HttpsError, bindSecrets } from '../core';
import { deleteImage } from '../core/cloudflare';

/**
 * deleteCarImage (staff, admin) – removes the image from the car (re-numbering order, keeping a cover) in a
 * transaction, then deletes it from Cloudflare Images (logged when not configured; `local:` ids are skipped).
 */
export const deleteCarImage = defineCallable('deleteCarImage', async (input, ctx) => {
  const ref = db.collection(COLLECTIONS.cars).doc(input.carId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Car not found');
    const images = ((snap.data()!.images as CarImage[]) ?? []).slice().sort((a, b) => a.order - b.order);
    const removed = images.find((i) => i.id === input.imageId);
    if (!removed) return;
    const rest = images.filter((i) => i.id !== input.imageId).map((img, order) => ({ ...img, order }));
    if (rest.length && !rest.some((i) => i.isCover)) rest[0] = { ...rest[0]!, isCover: true };
    // onCarWrite records the audit entry (images before/after, actor = updatedBy).
    tx.update(ref, { images: rest, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid });
  });
  if (!isLocalImageId(input.imageId)) {
    const ok = await deleteImage(input.imageId);
    if (!ok) logger.info(`Image ${input.imageId} not deleted from Cloudflare (not configured or already gone)`);
  }
  return { ok: true as const };
}, { secrets: bindSecrets('CF_IMAGES_API_TOKEN') });
