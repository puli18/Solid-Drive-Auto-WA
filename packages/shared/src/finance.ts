/** Indicative finance repayment calculator (estimate only; disclaimer must always be shown). */
import { FINANCE_TERM_MAX_MONTHS, FINANCE_TERM_MIN_MONTHS } from './constants';

export interface RepaymentInput {
  priceCents: number;
  depositCents?: number;
  termMonths: number;
  /** Annual percentage rate, e.g. 9.99 */
  ratePct: number;
}

export interface RepaymentResult {
  principalCents: number;
  monthlyCents: number;
  weeklyCents: number;
  totalRepayableCents: number;
  totalInterestCents: number;
}

/** Standard amortised payment for `n` periods at periodic rate `r`. */
export function amortisedPayment(principal: number, periodicRate: number, n: number): number {
  if (n <= 0) return 0;
  if (periodicRate === 0) return principal / n;
  return (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -n));
}

export function clampTerm(termMonths: number): number {
  return Math.min(
    FINANCE_TERM_MAX_MONTHS,
    Math.max(FINANCE_TERM_MIN_MONTHS, Math.round(termMonths)),
  );
}

/**
 * Monthly: n = term months, r = rate/12. Weekly: n = term × 52/12 weeks, r = rate/52.
 * Results are rounded to whole cents.
 */
export function calculateRepayments(input: RepaymentInput): RepaymentResult {
  const term = clampTerm(input.termMonths);
  const principalCents = Math.max(0, input.priceCents - (input.depositCents ?? 0));
  const rate = Math.max(0, input.ratePct) / 100;
  const monthly = amortisedPayment(principalCents, rate / 12, term);
  const weeks = Math.round((term * 52) / 12);
  const weekly = amortisedPayment(principalCents, rate / 52, weeks);
  const monthlyCents = Math.round(monthly);
  const totalRepayableCents = Math.round(monthly * term);
  return {
    principalCents,
    monthlyCents,
    weeklyCents: Math.round(weekly),
    totalRepayableCents,
    totalInterestCents: totalRepayableCents - principalCents,
  };
}
