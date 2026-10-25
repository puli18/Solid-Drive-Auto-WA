import { COLLECTIONS, DEFAULT_TIMEZONE } from '@sda/shared';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { Timestamp } from 'firebase-admin/firestore';
import { bindSecrets, db, FieldValue, REGION } from '../core';
import { sendBookingReminderEmail } from '../notify/bookings';
import { bookingForEmail, carLite } from './logic';

const HOUR = 3_600_000;

/**
 * Sends the 24 h reminder for confirmed bookings starting within the next 24 hours that haven't had one.
 * Bookings made less than 24 h ahead are skipped (the confirmation email was just sent).
 * Each booking is claimed in a transaction (reminderSentAt) before sending, so overlapping runs can't double-send.
 */
export async function runBookingReminders(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const snap = await db
    .collection(COLLECTIONS.bookings)
    .where('startAt', '>', Timestamp.fromDate(now))
    .where('startAt', '<=', Timestamp.fromDate(new Date(now.getTime() + 24 * HOUR)))
    .get();
  let sent = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const start = (d.startAt as Timestamp).toMillis();
    const created = (d.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    if (d.status !== 'confirmed' || d.reminderSentAt || d.deletedAt || start - created < 24 * HOUR) {
      skipped++;
      continue;
    }
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const f = fresh.data();
      if (!f || f.status !== 'confirmed' || f.reminderSentAt) return false;
      tx.update(doc.ref, { reminderSentAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) {
      skipped++;
      continue;
    }
    const car = carLite(await db.collection(COLLECTIONS.cars).doc(String(d.carId)).get());
    const ok = await sendBookingReminderEmail(bookingForEmail(doc.id, d, car?.published ? car.slug : null));
    if (ok) sent++;
    else {
      await doc.ref.update({ reminderSentAt: null }); // retry on the next run
      skipped++;
    }
  }
  return { sent, skipped };
}

/** Hourly: email a reminder 24 h before each confirmed booking (sets reminderSentAt). */
export const sendBookingReminders = onSchedule(
  { region: REGION, schedule: 'every 60 minutes', timeZone: DEFAULT_TIMEZONE, secrets: bindSecrets('RESEND_API_KEY') },
  async () => {
    const r = await runBookingReminders();
    logger.info(`Booking reminders: ${r.sent} sent, ${r.skipped} skipped`);
  },
);
