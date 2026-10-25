import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey,
  dateKeyInTz,
  daysBetween,
  formatDateAU,
  slotKey,
  slotLockId,
  toIsoInTz,
  weekdayOfDateKey,
  zonedToUtc,
} from '../src/time';
import { buildDaySlots, isValidSlotStart, openSlotsForDate } from '../src/slots';
import { DEFAULT_BOOKING_SETTINGS } from '../src/constants';
import { bookingSettingsSchema } from '../src/schemas/settings';

const settings = bookingSettingsSchema.parse(DEFAULT_BOOKING_SETTINGS);

describe('Perth time helpers', () => {
  it('converts Perth wall-clock to UTC (UTC+8, no DST)', () => {
    expect(zonedToUtc('2026-10-27', '09:00').toISOString()).toBe('2026-10-27T01:00:00.000Z');
    expect(zonedToUtc('2027-01-15', '09:00').toISOString()).toBe('2027-01-15T01:00:00.000Z');
    expect(toIsoInTz(new Date('2026-10-27T01:00:00Z'))).toBe('2026-10-27T09:00:00+08:00');
  });
  it('derives Perth calendar dates and keys', () => {
    const lateUtc = new Date('2026-10-27T17:30:00Z'); // 01:30 on the 28th in Perth
    expect(dateKeyInTz(lateUtc)).toBe('2026-10-28');
    expect(slotKey(lateUtc)).toBe('20261028_0130');
    expect(slotLockId('car1', lateUtc)).toBe('car1_20261028_0130');
    expect(formatDateAU(lateUtc)).toBe('28/10/2026');
  });
  it('does date-key arithmetic', () => {
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOfDateKey('2026-10-25')).toBe('sun');
    expect(weekdayOfDateKey('2026-10-26')).toBe('mon');
    expect(daysBetween('2026-01-01T00:00:00Z', '2026-03-02T00:00:00Z')).toBe(60);
  });
});

describe('slot building', () => {
  it('builds 45-min slots with 15-min buffer Mon–Fri 9–17', () => {
    const slots = buildDaySlots(settings, '2026-10-27');
    expect(slots.map((s) => s.iso.slice(11, 16))).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
    ]);
    expect(slots[0]!.iso).toBe('2026-10-27T09:00:00+08:00');
  });
  it('builds Saturday morning slots and no Sunday slots', () => {
    expect(buildDaySlots(settings, '2026-10-31')).toHaveLength(4);
    expect(buildDaySlots(settings, '2026-11-01')).toHaveLength(0);
  });
  it('applies notice, window and blackout rules', () => {
    const now = new Date('2026-10-27T02:30:00Z'); // 10:30 Perth
    const open = openSlotsForDate(settings, '2026-10-27', now).map((s) => s.iso.slice(11, 16));
    expect(open[0]).toBe('13:00'); // 2h notice → earliest 12:30
    expect(openSlotsForDate(settings, '2026-10-26', now)).toHaveLength(0); // past
    expect(openSlotsForDate(settings, '2026-12-31', now)).toHaveLength(0); // > 30 days
    expect(openSlotsForDate({ ...settings, blackoutDates: ['2026-10-28'] }, '2026-10-28', now)).toHaveLength(0);
    expect(isValidSlotStart(settings, new Date('2026-10-28T01:00:00Z'), now)).toBe(true);
    expect(isValidSlotStart(settings, new Date('2026-10-28T01:30:00Z'), now)).toBe(false);
  });
});
