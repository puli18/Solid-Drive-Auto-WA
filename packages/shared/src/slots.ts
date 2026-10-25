/**
 * Pure slot-building logic for getAvailability (the function adds lock/capacity filtering from Firestore).
 */
import type { BookingSettings } from './schemas/settings';
import {
  hhmmToMinutes,
  minutesToHhmm,
  toIsoInTz,
  weekdayOfDateKey,
  zonedToUtc,
  addDaysToDateKey,
  todayInTz,
} from './time';
import { DEFAULT_TIMEZONE } from './constants';

export interface CandidateSlot {
  startAt: Date;
  endAt: Date;
  /** ISO with zone offset, e.g. 2026-10-27T09:00:00+08:00 */
  iso: string;
}

type SlotRules = Pick<
  BookingSettings,
  | 'slotMinutes'
  | 'bufferMinutes'
  | 'weeklyHours'
  | 'blackoutDates'
  | 'minNoticeHours'
  | 'maxDaysAhead'
>;

/** All slots for a calendar date from weeklyHours (slot length + buffer between starts). No time filtering. */
export function buildDaySlots(
  settings: SlotRules,
  date: string,
  tz: string = DEFAULT_TIMEZONE,
): CandidateSlot[] {
  const ranges = settings.weeklyHours[weekdayOfDateKey(date)] ?? [];
  const step = settings.slotMinutes + settings.bufferMinutes;
  const out: CandidateSlot[] = [];
  for (const range of ranges) {
    const open = hhmmToMinutes(range.start);
    const close = hhmmToMinutes(range.end);
    for (let t = open; t + settings.slotMinutes <= close; t += step) {
      const startAt = zonedToUtc(date, minutesToHhmm(t), tz);
      const endAt = new Date(startAt.getTime() + settings.slotMinutes * 60_000);
      out.push({ startAt, endAt, iso: toIsoInTz(startAt, tz) });
    }
  }
  return out;
}

/** Whether a date is inside the bookable window (not blacked out, not past, not beyond maxDaysAhead). */
export function isDateBookable(
  settings: SlotRules,
  date: string,
  now: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE,
): boolean {
  if (settings.blackoutDates.includes(date)) return false;
  const today = todayInTz(tz, now);
  if (date < today) return false;
  return date <= addDaysToDateKey(today, settings.maxDaysAhead);
}

/** Day slots minus past / inside minNoticeHours / outside the bookable window. */
export function openSlotsForDate(
  settings: SlotRules,
  date: string,
  now: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE,
): CandidateSlot[] {
  if (!isDateBookable(settings, date, now, tz)) return [];
  const earliest = now.getTime() + settings.minNoticeHours * 3_600_000;
  return buildDaySlots(settings, date, tz).filter((s) => s.startAt.getTime() >= earliest);
}

/** True when `startAt` is exactly one of the generated slots for its date (used to validate createBooking input). */
export function isValidSlotStart(
  settings: SlotRules,
  startAt: Date,
  now: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE,
): boolean {
  const date = toIsoInTz(startAt, tz).slice(0, 10);
  return openSlotsForDate(settings, date, now, tz).some(
    (s) => s.startAt.getTime() === startAt.getTime(),
  );
}
