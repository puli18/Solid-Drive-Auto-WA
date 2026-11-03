import { describe, expect, it } from 'vitest';
import {
  appSettingsSchema,
  bookingSettingsSchema,
  businessSettingsSchema,
  DEFAULT_APP_SETTINGS,
  depositSettingsSchema,
  financeSettingsSchema,
  legalSettingsSchema,
} from '../src';
import { buildDemoDataset, DEMO_ACCOUNTS, defaultSettingsDocs } from '../src/demo';

const now = new Date('2026-10-25T02:00:00Z');

describe('demo dataset', () => {
  const ds = buildDemoDataset({ now });

  it('holds the two demo users and settings, and no cars or other records (cars live in Firestore)', () => {
    expect(ds.users.map((u) => u.id).sort()).toEqual([DEMO_ACCOUNTS.admin.uid, DEMO_ACCOUNTS.staff.uid].sort());
    for (const col of ['cars', 'carFinancials', 'vendors', 'expenses', 'sales', 'deposits', 'bookings', 'slotLocks', 'slotCounts', 'enquiries', 'auditLog'] as const) {
      expect(ds[col], col).toHaveLength(0);
    }
    expect(ds.settings.app.nextStockNo).toBe(DEFAULT_APP_SETTINGS.nextStockNo);
  });

  it('is deterministic for the same `now`', () => {
    expect(buildDemoDataset({ now })).toEqual(ds);
  });

  it('matches the stored settings schemas', () => {
    expect(businessSettingsSchema.safeParse(ds.settings.business).success).toBe(true);
    expect(bookingSettingsSchema.safeParse(ds.settings.booking).success).toBe(true);
    expect(depositSettingsSchema.safeParse(ds.settings.deposit).success).toBe(true);
    expect(financeSettingsSchema.safeParse(ds.settings.finance).success).toBe(true);
    expect(legalSettingsSchema.safeParse(ds.settings.legal).success).toBe(true);
    expect(appSettingsSchema.safeParse(ds.settings.app).success).toBe(true);
  });
});

describe('defaultSettingsDocs', () => {
  it('copies the defaults with meta fields and an optional nextStockNo', () => {
    const s = defaultSettingsDocs({ updatedBy: 'x' }, { nextStockNo: 1004 });
    expect(s.app).toMatchObject({ nextStockNo: 1004, updatedBy: 'x' });
    expect(s.business).toMatchObject({ dealerLicenceNo: 'MD33297', updatedBy: 'x' });
    expect(defaultSettingsDocs({}).app.nextStockNo).toBe(DEFAULT_APP_SETTINGS.nextStockNo);
  });
});
