/**
 * Money helpers. All amounts are integer cents (AUD). GST rates are percentages (10 = 10%).
 */
import { CURRENCY, DEFAULT_GST_RATE_PCT, LOCALE } from './constants';

/** Round half away from zero to an integer number of cents. */
export function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Convert dollars (number or "1,234.56" / "$1,234.56" string) to integer cents. Returns NaN for invalid input. */
export function toCents(dollars: number | string): number {
  const n = typeof dollars === 'number' ? dollars : Number(String(dollars).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return Number.NaN;
  return roundCents(n * 100);
}

/** Convert integer cents to dollars (float). Use only for display/inputs. */
export function fromCents(cents: number): number {
  return cents / 100;
}

export interface FormatAudOptions {
  /** Show cents. Default: only when the amount has cents. */
  cents?: boolean | 'auto';
}

/** Format cents as AUD, e.g. 4250000 -> "$42,500" and 12345 -> "$123.45". */
export function formatAUD(cents: number, opts: FormatAudOptions = {}): string {
  const mode = opts.cents ?? 'auto';
  const showCents = mode === 'auto' ? cents % 100 !== 0 : mode;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100);
}

/** GST component contained in a GST-inclusive total: total * rate / (100 + rate). */
export function gstFromTotal(totalCents: number, ratePct: number = DEFAULT_GST_RATE_PCT): number {
  if (ratePct <= 0) return 0;
  return roundCents((totalCents * ratePct) / (100 + ratePct));
}

/** GST payable on a GST-exclusive amount: ex * rate / 100. */
export function gstOnExclusive(exGstCents: number, ratePct: number = DEFAULT_GST_RATE_PCT): number {
  if (ratePct <= 0) return 0;
  return roundCents((exGstCents * ratePct) / 100);
}

export interface GstSplit {
  amountExGstCents: number;
  gstCents: number;
  totalCents: number;
}

/** Split a GST-inclusive total into ex-GST + GST. `gstOverrideCents` lets the user override the auto GST. */
export function splitGstInclusive(
  totalCents: number,
  ratePct: number = DEFAULT_GST_RATE_PCT,
  gstOverrideCents?: number,
): GstSplit {
  const gstCents = gstOverrideCents ?? gstFromTotal(totalCents, ratePct);
  return { amountExGstCents: totalCents - gstCents, gstCents, totalCents };
}

/** Build a split from a GST-exclusive amount. */
export function splitGstExclusive(
  exGstCents: number,
  ratePct: number = DEFAULT_GST_RATE_PCT,
): GstSplit {
  const gstCents = gstOnExclusive(exGstCents, ratePct);
  return { amountExGstCents: exGstCents, gstCents, totalCents: exGstCents + gstCents };
}

export function sumCents(values: Iterable<number | null | undefined>): number {
  let total = 0;
  for (const v of values) total += v ?? 0;
  return total;
}

export interface ProfitInput {
  purchasePriceExGstCents: number;
  expensesExGstCents: number;
  salePriceExGstCents?: number | null;
}

export interface ProfitSummary {
  totalCostCents: number;
  grossProfitCents: number | null;
  /** Margin as a percentage of sale price ex GST (e.g. 12.5), null when unsold or sale price is 0. */
  marginPct: number | null;
}

/** total cost = purchase + expenses; gross profit = sale − total cost; margin = profit / sale. All ex GST. */
export function profitSummary(input: ProfitInput): ProfitSummary {
  const totalCostCents = input.purchasePriceExGstCents + input.expensesExGstCents;
  if (input.salePriceExGstCents == null) {
    return { totalCostCents, grossProfitCents: null, marginPct: null };
  }
  const grossProfitCents = input.salePriceExGstCents - totalCostCents;
  const marginPct =
    input.salePriceExGstCents === 0
      ? null
      : Math.round((grossProfitCents / input.salePriceExGstCents) * 10000) / 100;
  return { totalCostCents, grossProfitCents, marginPct };
}
