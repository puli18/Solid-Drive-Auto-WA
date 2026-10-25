import { describe, expect, it } from 'vitest';
import { allowedNextCarStatuses, availabilityProblems, canTransitionBooking, canTransitionCar } from '../src/status';

const ready = { make: 'Toyota', model: 'Hilux', year: 2021, priceCents: 4500000, images: [{}] };

describe('car status transitions', () => {
  it('requires photo, price and make/model/year for Available', () => {
    expect(canTransitionCar('draft', 'available', { role: 'staff', car: ready })).toEqual({ ok: true });
    const res = canTransitionCar('draft', 'available', { role: 'staff', car: { ...ready, images: [], priceCents: 0 } });
    expect(res.ok).toBe(false);
    expect(availabilityProblems({})).toHaveLength(5);
  });
  it('follows the Draft → Available → Reserved → Sold path', () => {
    expect(canTransitionCar('available', 'reserved', { role: 'staff' }).ok).toBe(true);
    expect(canTransitionCar('reserved', 'sold', { role: 'staff' }).ok).toBe(true);
    expect(canTransitionCar('draft', 'sold', { role: 'admin' }).ok).toBe(false);
    expect(canTransitionCar('sold', 'available', { role: 'admin' }).ok).toBe(false);
  });
  it('allows Withdrawn from any state', () => {
    for (const s of ['draft', 'available', 'reserved'] as const) {
      expect(canTransitionCar(s, 'withdrawn', { role: 'staff' }).ok).toBe(true);
    }
    expect(canTransitionCar('sold', 'withdrawn', { role: 'admin' }).ok).toBe(true);
  });
  it('restricts releasing a reservation to admin', () => {
    expect(canTransitionCar('reserved', 'available', { role: 'staff' }).ok).toBe(false);
    expect(canTransitionCar('reserved', 'available', { role: 'admin' }).ok).toBe(true);
    expect(allowedNextCarStatuses('reserved', 'staff')).toEqual(['sold', 'withdrawn']);
  });
  it('booking transitions', () => {
    expect(canTransitionBooking('confirmed', 'attended')).toBe(true);
    expect(canTransitionBooking('cancelled', 'confirmed')).toBe(false);
  });
});
