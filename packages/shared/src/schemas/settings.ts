import { z } from 'zod';
import { WEEKDAYS } from '../constants';
import { addressSchema, zCents, zDateKey, zEmail, zHhmm } from './common';

const timeRangeSchema = z
  .object({ start: zHhmm, end: zHhmm })
  .refine((r) => r.start < r.end, { message: 'End must be after start', path: ['end'] });

export const weeklyHoursSchema = z.object(
  Object.fromEntries(
    WEEKDAYS.map((d) => [d, z.array(timeRangeSchema).max(4).default([])]),
  ) as Record<(typeof WEEKDAYS)[number], z.ZodDefault<z.ZodArray<typeof timeRangeSchema>>>,
);
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

/** settings/business – public read. gstRate is a PERCENT (10 = 10%). */
export const businessSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().max(40).default(''),
  abn: z.string().trim().max(20),
  dealerLicenceNo: z.string().trim().max(40),
  address: addressSchema,
  phone: z.string().trim().max(30),
  email: zEmail,
  /** Free-text opening hours for display (booking hours are in settings/booking). */
  hours: z.string().trim().max(300),
  timezone: z.string().min(1).default('Australia/Perth'),
  gstRate: z.number().min(0).max(100),
  /** Path or URL to the logo. */
  logo: z.string().max(500).default(''),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

/** settings/booking – public read. */
export const bookingSettingsSchema = z.object({
  slotMinutes: z.number().int().min(10).max(240),
  bufferMinutes: z.number().int().min(0).max(120),
  weeklyHours: weeklyHoursSchema,
  blackoutDates: z.array(zDateKey).max(366).default([]),
  maxPerSlot: z.number().int().min(1).max(50),
  minNoticeHours: z
    .number()
    .min(0)
    .max(24 * 14),
  maxDaysAhead: z.number().int().min(1).max(365),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

/** settings/deposit – public read. */
export const depositSettingsSchema = z.object({
  amountCents: zCents.min(100),
  termsText: z.string().trim().min(1).max(20_000),
  termsVersion: z.string().min(1),
  enabled: z.boolean(),
});
export type DepositSettings = z.infer<typeof depositSettingsSchema>;

/** settings/finance – public read. */
export const financeSettingsSchema = z.object({
  indicativeRatePct: z.number().min(0).max(50),
  disclaimer: z.string().trim().min(1).max(5000),
});
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;

/** settings/legal – public read (privacy, terms, deposit terms page, warranty). */
export const legalSettingsSchema = z.object({
  privacyText: z.string().max(100_000),
  termsText: z.string().max(100_000),
  depositTermsText: z.string().max(100_000),
  warrantyText: z.string().max(100_000).default(''),
});
export type LegalSettings = z.infer<typeof legalSettingsSchema>;

/** settings/app – admin only (non-public tunables, e.g. aged stock threshold). */
export const appSettingsSchema = z.object({
  agedStockDays: z.number().int().min(1).max(365),
  /** Next stock number counter, e.g. 1021 → SDA1021. */
  nextStockNo: z.number().int().min(1).optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

/** Audit fields on settings docs are optional (updatedAt/updatedBy only). */
export const settingsMetaSchema = z.object({
  updatedAt: z.unknown().optional(),
  updatedBy: z.string().optional(),
});
