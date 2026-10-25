import { describe, expect, it } from 'vitest';
import {
  formatAUD,
  fromCents,
  gstFromTotal,
  gstOnExclusive,
  profitSummary,
  splitGstExclusive,
  splitGstInclusive,
  sumCents,
  toCents,
} from '../src/money';

describe('money', () => {
  it('converts dollars to cents without float drift', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents('1,234.56')).toBe(123456);
    expect(toCents('$42,500')).toBe(4250000);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(Number.isNaN(toCents('abc'))).toBe(true);
    expect(fromCents(1999)).toBe(19.99);
  });

  it('formats AUD', () => {
    expect(formatAUD(4250000)).toBe('$42,500');
    expect(formatAUD(12345)).toBe('$123.45');
    expect(formatAUD(4250000, { cents: true })).toBe('$42,500.00');
  });

  it('extracts GST from a GST-inclusive total at 10%', () => {
    expect(gstFromTotal(11000, 10)).toBe(1000);
    expect(gstFromTotal(110, 10)).toBe(10);
    expect(gstFromTotal(100, 10)).toBe(9); // 9.0909 → 9
    expect(gstFromTotal(5000, 0)).toBe(0);
    expect(gstFromTotal(11500, 15)).toBe(1500);
  });

  it('splits totals and supports a GST override', () => {
    expect(splitGstInclusive(33000)).toEqual({ amountExGstCents: 30000, gstCents: 3000, totalCents: 33000 });
    expect(splitGstInclusive(33000, 10, 0)).toEqual({ amountExGstCents: 33000, gstCents: 0, totalCents: 33000 });
    expect(splitGstExclusive(30000)).toEqual({ amountExGstCents: 30000, gstCents: 3000, totalCents: 33000 });
    expect(gstOnExclusive(12345, 10)).toBe(1235);
  });

  it('sums and computes profit + margin ex GST', () => {
    expect(sumCents([100, null, undefined, 250])).toBe(350);
    expect(
      profitSummary({ purchasePriceExGstCents: 2000000, expensesExGstCents: 150000, salePriceExGstCents: 2500000 }),
    ).toEqual({ totalCostCents: 2150000, grossProfitCents: 350000, marginPct: 14 });
    expect(profitSummary({ purchasePriceExGstCents: 100, expensesExGstCents: 0 })).toEqual({
      totalCostCents: 100,
      grossProfitCents: null,
      marginPct: null,
    });
  });
});
