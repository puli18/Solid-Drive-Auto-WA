import { describe, expect, it } from 'vitest';
import { amortisedPayment, calculateRepayments, clampTerm } from '../src/finance';

describe('finance calculator', () => {
  it('matches the standard amortisation formula', () => {
    // $30,000 over 60 months at 9.99% p.a. → $637.26/month (standard calculators)
    const r = calculateRepayments({ priceCents: 3_500_000, depositCents: 500_000, termMonths: 60, ratePct: 9.99 });
    expect(r.principalCents).toBe(3_000_000);
    expect(r.monthlyCents).toBe(63726);
    expect(r.weeklyCents).toBeGreaterThan(14600);
    expect(r.weeklyCents).toBeLessThan(14720);
    expect(r.totalInterestCents).toBe(r.totalRepayableCents - r.principalCents);
  });
  it('handles a zero rate and clamps the term to 12–84 months', () => {
    expect(amortisedPayment(1200, 0, 12)).toBe(100);
    expect(calculateRepayments({ priceCents: 1_200_000, termMonths: 12, ratePct: 0 }).monthlyCents).toBe(100_000);
    expect(clampTerm(6)).toBe(12);
    expect(clampTerm(120)).toBe(84);
  });
  it('never goes negative when the deposit exceeds the price', () => {
    expect(calculateRepayments({ priceCents: 1000, depositCents: 5000, termMonths: 24, ratePct: 9.99 }).monthlyCents).toBe(0);
  });
});
