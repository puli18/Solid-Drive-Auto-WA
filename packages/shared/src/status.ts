/**
 * Status transition rules.
 * Cars: Draft → Available (needs ≥1 photo, a price, make/model/year) → Reserved → Sold.
 * Withdrawn can be set from any state. Reserved → Available ("release") is admin only.
 */
import type { BookingStatus, CarStatus, Role } from './constants';

export const CAR_STATUS_TRANSITIONS: Record<CarStatus, readonly CarStatus[]> = {
  draft: ['available', 'withdrawn'],
  available: ['reserved', 'sold', 'withdrawn', 'draft'],
  reserved: ['sold', 'available', 'withdrawn'],
  sold: ['withdrawn'],
  withdrawn: ['draft', 'available'],
};

/** Transitions only an admin may perform. */
export const ADMIN_ONLY_CAR_TRANSITIONS: ReadonlyArray<readonly [CarStatus, CarStatus]> = [
  ['reserved', 'available'],
  ['sold', 'withdrawn'],
];

export interface CarReadinessInput {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  priceCents?: number | null;
  images?: readonly unknown[] | null;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

/** Missing requirements for listing a car as Available (empty array = ready). */
export function availabilityProblems(car: CarReadinessInput): string[] {
  const problems: string[] = [];
  if (!car.images || car.images.length < 1) problems.push('Add at least 1 photo');
  if (!car.priceCents || car.priceCents <= 0) problems.push('Set a price');
  if (!car.make) problems.push('Set the make');
  if (!car.model) problems.push('Set the model');
  if (!car.year) problems.push('Set the year');
  return problems;
}

export function canTransitionCar(
  from: CarStatus,
  to: CarStatus,
  opts: { role: Role; car?: CarReadinessInput },
): TransitionResult {
  if (from === to) return { ok: true };
  if (!CAR_STATUS_TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: `Can't change status from ${from} to ${to}` };
  }
  if (
    opts.role !== 'admin' &&
    ADMIN_ONLY_CAR_TRANSITIONS.some(([f, t]) => f === from && t === to)
  ) {
    return { ok: false, reason: 'Only an admin can make this change' };
  }
  if (to === 'available' && opts.car) {
    const problems = availabilityProblems(opts.car);
    if (problems.length) return { ok: false, reason: problems.join('; ') };
  }
  return { ok: true };
}

export function allowedNextCarStatuses(from: CarStatus, role: Role): CarStatus[] {
  return CAR_STATUS_TRANSITIONS[from].filter((to) => canTransitionCar(from, to, { role }).ok);
}

/** Statuses in which public Book / Reserve buttons are offered. */
export function isBookable(status: CarStatus, published: boolean): boolean {
  return published && status === 'available';
}

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  confirmed: ['cancelled', 'attended', 'no-show'],
  cancelled: [],
  attended: ['no-show'],
  'no-show': ['attended'],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return from === to || BOOKING_STATUS_TRANSITIONS[from].includes(to);
}
