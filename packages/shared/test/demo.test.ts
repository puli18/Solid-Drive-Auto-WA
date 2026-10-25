import { describe, expect, it } from 'vitest';
import {
  bookingSettingsSchema,
  businessSettingsSchema,
  carSchema,
  depositSettingsSchema,
  expenseSchema,
  financeSettingsSchema,
} from '../src';
import { buildDemoDataset, DEMO_ACCOUNTS } from '../src/demo';

const now = new Date('2026-10-25T02:00:00Z');

describe('demo dataset', () => {
  const ds = buildDemoDataset({ now });

  it('has the expected sample sizes', () => {
    expect(ds.cars).toHaveLength(20);
    expect(ds.carFinancials).toHaveLength(20);
    expect(ds.sales).toHaveLength(1);
    expect(ds.deposits).toHaveLength(1);
    expect(ds.bookings.length).toBeGreaterThanOrEqual(4);
    expect(ds.enquiries.length).toBeGreaterThanOrEqual(3);
    expect(ds.expenses.length).toBeGreaterThan(20);
    expect(ds.users.map((u) => u.id).sort()).toEqual([DEMO_ACCOUNTS.admin.uid, DEMO_ACCOUNTS.staff.uid].sort());
  });

  it('is deterministic for the same `now`', () => {
    expect(buildDemoDataset({ now })).toEqual(ds);
  });

  it('matches the stored-document schemas', () => {
    for (const c of ds.cars) expect(carSchema.safeParse(c).success, String(c.id)).toBe(true);
    for (const e of ds.expenses) expect(expenseSchema.safeParse(e).success, String(e.id)).toBe(true);
    expect(businessSettingsSchema.safeParse(ds.settings.business).success).toBe(true);
    expect(bookingSettingsSchema.safeParse(ds.settings.booking).success).toBe(true);
    expect(depositSettingsSchema.safeParse(ds.settings.deposit).success).toBe(true);
    expect(financeSettingsSchema.safeParse(ds.settings.finance).success).toBe(true);
  });

  it('has unique slugs and local image ids car-01…car-12', () => {
    expect(new Set(ds.cars.map((c) => c.slug)).size).toBe(20);
    for (const c of ds.cars) {
      const id = (c.images as { id: string }[])[0]!.id;
      expect(id).toMatch(/^local:cars\/car-(0[1-9]|1[0-2])\.webp$/);
    }
  });
});
