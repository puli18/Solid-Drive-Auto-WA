import { defineCallable } from '../core';
import { computeAvailability } from './logic';

/**
 * getAvailability (public) – open slots for a car and date: weeklyHours in the dealership zone, minus past /
 * inside minNoticeHours / beyond maxDaysAhead / blackout dates / locked for this car / at maxPerSlot.
 * Staff and admins (signed in) may see slots inside the notice window (phone bookings).
 */
export const getAvailability = defineCallable('getAvailability', async (input, ctx) => {
  return computeAvailability(input.carId, input.date, { ignoreNotice: ctx.role === 'staff' || ctx.role === 'admin' });
});
