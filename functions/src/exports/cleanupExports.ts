import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { DEFAULT_TIMEZONE } from '@sda/shared';
import { bucket, REGION } from '../core';

const MAX_AGE_MS = 24 * 3_600_000;

/** Deletes generated exports older than 24 h. (A bucket lifecycle rule on exports/ is an equivalent alternative.) */
export async function deleteOldExports(now = Date.now()): Promise<number> {
  const [files] = await bucket().getFiles({ prefix: 'exports/' });
  let n = 0;
  for (const f of files) {
    const created = Date.parse(String(f.metadata.timeCreated ?? ''));
    if (Number.isFinite(created) && now - created > MAX_AGE_MS) {
      await f.delete({ ignoreNotFound: true });
      n++;
    }
  }
  return n;
}

export const cleanupExports = onSchedule({ region: REGION, schedule: 'every 60 minutes', timeZone: DEFAULT_TIMEZONE }, async () => {
  const n = await deleteOldExports();
  if (n) logger.info(`Deleted ${n} export file(s) older than 24 h`);
});
