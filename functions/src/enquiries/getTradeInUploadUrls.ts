import { randomUUID } from 'node:crypto';
import { DEFAULT_TIMEZONE, TRADE_IN_IMAGE_PREFIX, todayInTz } from '@sda/shared';
import { assertTurnstile, defineCallable, bindSecrets } from '../core';
import { createDirectUpload } from '../core/cloudflare';

/**
 * getTradeInUploadUrls (public, Turnstile) – Cloudflare Images direct-upload URLs for up to 6 trade-in
 * photos, under the `trade-in/` custom-id prefix (kept separate from car photos).
 * Without Cloudflare credentials this fails with failed-precondition (the form can still be sent without photos).
 */
export const getTradeInUploadUrls = defineCallable('getTradeInUploadUrls', async (input, ctx) => {
  await assertTurnstile(input.turnstileToken, ctx.ip);
  const day = todayInTz(DEFAULT_TIMEZONE);
  const uploads = await Promise.all(
    Array.from({ length: input.count }, () =>
      createDirectUpload({ customId: `${TRADE_IN_IMAGE_PREFIX}${day}/${randomUUID()}`, metadata: { kind: 'trade-in' } }),
    ),
  );
  return { uploads };
}, { secrets: bindSecrets('TURNSTILE_SECRET_KEY', 'CF_IMAGES_API_TOKEN') });
