/**
 * Dealership time-zone helpers (default Australia/Perth, UTC+8, no DST – but every helper takes `tz`
 * so the setting stays editable). Date-only values use "YYYY-MM-DD" strings; instants are Date objects
 * or ISO strings with an offset.
 */
import { addDays, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { DEFAULT_TIMEZONE, type Weekday, WEEKDAYS } from './constants';

export type DateInput = Date | string | number | { toDate(): Date };

export function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return parseISO(value);
  return value.toDate();
}

/** Format an instant in the dealership time zone (date-fns tokens), e.g. formatInTz(d, 'EEE d MMM, h:mm a'). */
export function formatInTz(
  value: DateInput,
  pattern: string,
  tz: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(toDate(value), tz, pattern);
}

/** dd/MM/yyyy – the AU display format. */
export function formatDateAU(value: DateInput, tz: string = DEFAULT_TIMEZONE): string {
  return formatInTz(value, 'dd/MM/yyyy', tz);
}

export function formatDateTimeAU(value: DateInput, tz: string = DEFAULT_TIMEZONE): string {
  return formatInTz(value, 'EEE d MMM yyyy, h:mm a', tz);
}

/** ISO 8601 with the zone's offset, e.g. 2026-10-27T09:00:00+08:00 (used for slot strings). */
export function toIsoInTz(value: DateInput, tz: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** The calendar date ("YYYY-MM-DD") of an instant in the zone. */
export function dateKeyInTz(value: DateInput, tz: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, 'yyyy-MM-dd');
}

/** Wall-clock date + time in the zone → UTC instant. zonedToUtc('2026-10-27', '09:00') */
export function zonedToUtc(
  date: string,
  time: string = '00:00',
  tz: string = DEFAULT_TIMEZONE,
): Date {
  return fromZonedTime(`${date}T${time}:00`, tz);
}

/** Start of the given calendar date in the zone, as a UTC instant. */
export function startOfDayInTz(date: string, tz: string = DEFAULT_TIMEZONE): Date {
  return zonedToUtc(date, '00:00', tz);
}

/** Today's date ("YYYY-MM-DD") in the zone. */
export function todayInTz(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return dateKeyInTz(now, tz);
}

/** Add whole days to a "YYYY-MM-DD" string (calendar arithmetic, zone independent). */
export function addDaysToDateKey(date: string, days: number): string {
  const d = addDays(parseISO(`${date}T12:00:00Z`), days);
  return d.toISOString().slice(0, 10);
}

/** Weekday key ('mon'…'sun') of a "YYYY-MM-DD" calendar date. */
export function weekdayOfDateKey(date: string): Weekday {
  const jsDay = parseISO(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(jsDay + 6) % 7]!;
}

/** Zoned wall-clock parts of an instant. */
export function zonedParts(value: DateInput, tz: string = DEFAULT_TIMEZONE) {
  const z = toZonedTime(toDate(value), tz);
  return {
    year: z.getFullYear(),
    month: z.getMonth() + 1,
    day: z.getDate(),
    hour: z.getHours(),
    minute: z.getMinutes(),
  };
}

/** Slot key "YYYYMMDD_HHmm" in the zone – used for slotCounts/{key}. */
export function slotKey(value: DateInput, tz: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, 'yyyyMMdd_HHmm');
}

/** slotLocks document id "{carId}_YYYYMMDD_HHmm". */
export function slotLockId(carId: string, value: DateInput, tz: string = DEFAULT_TIMEZONE): string {
  return `${carId}_${slotKey(value, tz)}`;
}

/** Whole days between two instants (floor), e.g. days in stock. */
export function daysBetween(from: DateInput, to: DateInput = new Date()): number {
  return Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** "HH:mm" → minutes after midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
