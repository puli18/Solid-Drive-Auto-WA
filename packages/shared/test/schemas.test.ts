import { describe, expect, it } from 'vitest';
import {
  businessSettingsSchema,
  callableSchemas,
  carInputSchema,
  createBookingInput,
  createEnquiryInput,
  expenseInputSchema,
} from '../src';
import { DEFAULT_BUSINESS_SETTINGS } from '../src/constants';
import { resolveImageUrl, sortCarImages } from '../src/images';

describe('schemas', () => {
  it('parses a car input with defaults', () => {
    const car = carInputSchema.parse({
      stockNo: 'sda1001',
      make: 'Toyota',
      model: 'Hilux',
      year: 2021,
      bodyType: 'ute',
      transmission: 'automatic',
      fuel: 'diesel',
      km: 45000,
      priceCents: 4599000,
    });
    expect(car.stockNo).toBe('SDA1001');
    expect(car.status).toBe('draft');
    expect(car.images).toEqual([]);
  });
  it('rejects stock numbers with hyphens', () => {
    expect(carInputSchema.safeParse({ stockNo: 'SDA-1' }).success).toBe(false);
  });
  it('requires expense totals to add up', () => {
    const base = { date: '2026-10-01', category: 'tyres', description: 'Tyres', amountExGstCents: 100000, gstCents: 10000 };
    expect(expenseInputSchema.safeParse({ ...base, totalCents: 110000 }).success).toBe(true);
    expect(expenseInputSchema.safeParse({ ...base, totalCents: 110001 }).success).toBe(false);
  });
  it('requires licence confirmation for test drives', () => {
    const b = {
      carId: 'c1',
      type: 'test-drive',
      startAt: '2026-10-27T09:00:00+08:00',
      customer: { name: 'Jo', phone: '0400 000 000', email: 'jo@example.com' },
      turnstileToken: 'x',
    };
    expect(createBookingInput.safeParse(b).success).toBe(false);
    expect(createBookingInput.safeParse({ ...b, licenceConfirmed: true }).success).toBe(true);
    expect(createBookingInput.safeParse({ ...b, type: 'inspection' }).success).toBe(true);
  });
  it('requires vehicle details for trade-in enquiries', () => {
    const e = {
      type: 'trade-in',
      customer: { name: 'Jo', phone: '0400000000', email: 'jo@example.com' },
      turnstileToken: 'x',
    };
    expect(createEnquiryInput.safeParse(e).success).toBe(false);
  });
  it('validates the default business settings and lists every callable', () => {
    expect(businessSettingsSchema.safeParse(DEFAULT_BUSINESS_SETTINGS).success).toBe(true);
    expect(Object.keys(callableSchemas)).toContain('exportStockReport');
  });
});

describe('images', () => {
  it('maps local and Cloudflare ids', () => {
    expect(resolveImageUrl('local:cars/car-01.webp', 'card')).toBe('/images/cars/car-01.webp');
    expect(resolveImageUrl('abc-123', 'thumb', { deliveryUrl: 'https://imagedelivery.net/HASH/' })).toBe(
      'https://imagedelivery.net/HASH/abc-123/thumb',
    );
    expect(sortCarImages([{ order: 0 }, { order: 1, isCover: true }])[0]!.order).toBe(1);
  });
});
