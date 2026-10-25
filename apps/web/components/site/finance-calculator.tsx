import { useId, useState } from 'react';
import { calculateRepayments, FINANCE_TERM_MAX_MONTHS, FINANCE_TERM_MIN_MONTHS, formatAUD } from '@sda/shared';
import { cn } from '@/lib/utils';

const TERMS = [12, 24, 36, 48, 60, 72, 84].filter((t) => t >= FINANCE_TERM_MIN_MONTHS && t <= FINANCE_TERM_MAX_MONTHS);

const toNumber = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const money = (n: number) => (n ? n.toLocaleString('en-AU') : '');

/**
 * Indicative repayment calculator. Inputs: price (prefilled from a car), deposit, term 12–84 months and rate
 * (default from settings/finance). The disclaimer is always visible.
 */
export function FinanceCalculator({
  priceCents,
  ratePct,
  disclaimer,
  tone = 'light',
  compact = false,
  className,
}: {
  priceCents?: number;
  ratePct: number;
  disclaimer: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const [price, setPrice] = useState(money(Math.round((priceCents ?? 3_000_000) / 100)));
  const [deposit, setDeposit] = useState(money(Math.round((priceCents ?? 3_000_000) / 1000)));
  const [term, setTerm] = useState(60);
  const [rate, setRate] = useState(String(ratePct));

  const priceN = toNumber(price);
  const depositN = Math.min(toNumber(deposit), priceN);
  const rateN = Math.min(50, toNumber(rate));
  const r = calculateRepayments({ priceCents: priceN * 100, depositCents: depositN * 100, termMonths: term, ratePct: rateN });
  const dark = tone === 'dark';

  const inputCls = cn(
    'h-12 w-full rounded-lg px-3 text-base font-medium outline-none ring-1 transition-shadow focus-visible:ring-2 sda-num',
    dark ? 'bg-white/[0.06] text-white ring-white/12 focus-visible:ring-white/60' : 'bg-white text-black ring-black/12 focus-visible:ring-[var(--ring)]',
  );
  const labelCls = cn('mb-1.5 block text-sm font-medium', dark ? 'text-white/75' : 'text-black/70');

  return (
    <div className={cn('rounded-2xl', dark ? 'bg-brand-graphite text-white' : 'bg-brand-stone text-black', compact ? 'p-5 sm:p-6' : 'p-5 sm:p-8', className)}>
      <div className={cn('grid gap-4', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        <div className={compact ? 'sm:col-span-2' : undefined}>
          <label htmlFor={`${id}-price`} className={labelCls}>
            Car price
          </label>
          <div className="relative">
            <span className={cn('pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-medium', dark ? 'text-white/60' : 'text-black/50')}>$</span>
            <input
              id={`${id}-price`}
              inputMode="numeric"
              autoComplete="off"
              value={price}
              onChange={(e) => setPrice(money(toNumber(e.target.value)))}
              className={cn(inputCls, 'pl-7')}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-deposit`} className={labelCls}>
            Deposit / trade-in
          </label>
          <div className="relative">
            <span className={cn('pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-medium', dark ? 'text-white/60' : 'text-black/50')}>$</span>
            <input
              id={`${id}-deposit`}
              inputMode="numeric"
              autoComplete="off"
              value={deposit}
              onChange={(e) => setDeposit(money(toNumber(e.target.value)))}
              className={cn(inputCls, 'pl-7')}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-rate`} className={labelCls}>
            Interest rate (p.a.)
          </label>
          <div className="relative">
            <input
              id={`${id}-rate`}
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
              className={cn(inputCls, 'pr-8')}
            />
            <span className={cn('pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-medium', dark ? 'text-white/60' : 'text-black/50')}>%</span>
          </div>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className={labelCls}>Loan term</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {TERMS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={term === t}
              onClick={() => setTerm(t)}
              className={cn(
                'sda-press h-11 rounded-lg text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                term === t
                  ? 'bg-brand-red text-white'
                  : dark
                    ? 'bg-white/[0.06] text-white/80 hover:bg-white/10'
                    : 'bg-white text-black/75 ring-1 ring-black/10 hover:text-black',
              )}
            >
              {t / 12}
              <span className="sr-only"> years</span>
              <span aria-hidden className="text-[11px] font-medium opacity-70">
                y
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div
        aria-live="polite"
        className={cn('mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl', dark ? 'bg-white/10' : 'bg-black/10')}
      >
        <Output label="Weekly" value={formatAUD(r.weeklyCents, { cents: false })} dark={dark} emphasis />
        <Output label="Monthly" value={formatAUD(r.monthlyCents, { cents: false })} dark={dark} />
        {!compact ? (
          <>
            <Output label="Amount financed" value={formatAUD(r.principalCents, { cents: false })} dark={dark} small />
            <Output label="Total interest" value={formatAUD(r.totalInterestCents, { cents: false })} dark={dark} small />
          </>
        ) : null}
      </div>

      <p className={cn('mt-4 text-xs leading-relaxed', dark ? 'text-white/60' : 'text-black/60')}>{disclaimer}</p>
    </div>
  );
}

function Output({ label, value, dark, emphasis, small }: { label: string; value: string; dark: boolean; emphasis?: boolean; small?: boolean }) {
  return (
    <div className={cn('p-4', dark ? 'bg-brand-graphite' : 'bg-brand-stone')}>
      <p className={cn('text-xs font-medium', dark ? 'text-white/60' : 'text-black/60')}>{label}</p>
      <p
        className={cn('font-display sda-num mt-1 font-extrabold tracking-tight', small ? 'text-xl' : 'text-3xl', emphasis && 'text-brand-red')}
        style={{ fontStretch: '110%' }}
      >
        {value}
      </p>
    </div>
  );
}
