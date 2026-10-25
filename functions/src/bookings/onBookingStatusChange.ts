import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { REGION } from '../core';
import { releaseBookingSlot } from './logic';

/**
 * Staff/admin can set a booking's status to `cancelled` directly from the dashboard (rules allow
 * status/notes only). This trigger releases the slot lock and decrements slotCounts when that happens.
 * Idempotent: it only releases a lock still held by this booking (cancelBooking already releases in its
 * own transaction, so the trigger is then a no-op).
 */
export const onBookingStatusChange = onDocumentUpdated(
  { region: REGION, document: 'bookings/{bookingId}' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status || after.status !== 'cancelled') return;
    const released = await releaseBookingSlot(event.params.bookingId);
    logger.info(`Booking ${event.params.bookingId} cancelled – slot ${released ? 'released' : 'already free'}`);
  },
);
