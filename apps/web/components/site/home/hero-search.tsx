import { useRouter } from '@/lib/navigation';
import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeroSearchProps {
  makes: string[];
  modelsByMake: Record<string, string[]>;
  years: number[];
  priceSteps: number[];
  count: number;
}

const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

/** Search bar overlaying the hero. Native selects: fast, accessible, and the best picker on phones. */
export function HeroSearch({ makes, modelsByMake, years, priceSteps, count }: HeroSearchProps) {
  const router = useRouter();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const models = useMemo(() => (make ? (modelsByMake[make] ?? []) : []), [make, modelsByMake]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (make) q.set('make', make);
    if (model) q.set('model', model);
    if (yearMin) q.set('yearMin', yearMin);
    if (priceMax) q.set('priceMax', priceMax);
    router.push(`/cars${q.size ? `?${q}` : ''}`);
  }

  return (
    <form
      role="search"
      aria-label="Search cars"
      onSubmit={submit}
      className="bg-brand-black/70 rounded-2xl border border-white/12 p-3 backdrop-blur-xl sm:p-4"
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <p className="text-sm font-semibold text-white">Find your next car</p>
        <p className="text-muted-foreground text-xs">
          <span className="sda-num text-white">{count}</span> in stock now
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <Field label="Make">
          <select
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel('');
            }}
          >
            <option value="">Any make</option>
            {makes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Model" disabled={!make}>
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!make}>
            <option value="">{make ? 'Any model' : 'Choose a make'}</option>
            {models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Year from">
          <select value={yearMin} onChange={(e) => setYearMin(e.target.value)}>
            <option value="">Any year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y} or newer
              </option>
            ))}
          </select>
        </Field>
        <Field label="Max price">
          <select value={priceMax} onChange={(e) => setPriceMax(e.target.value)}>
            <option value="">Any price</option>
            {priceSteps.map((p) => (
              <option key={p} value={p}>
                Up to {fmt.format(p)}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          className="sda-press bg-brand-red hover:bg-brand-red-hover col-span-2 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white lg:col-span-1 lg:aspect-square lg:h-auto lg:px-0"
        >
          <Search className="size-5" aria-hidden />
          <span className="lg:sr-only">Search cars</span>
        </button>
      </div>
    </form>
  );
}

function Field({ label, disabled, children }: { label: string; disabled?: boolean; children: React.ReactElement }) {
  return (
    <label
      className={cn(
        'relative flex h-14 flex-col justify-center rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 transition-colors focus-within:ring-2 focus-within:ring-white/60 hover:bg-white/[0.09]',
        disabled && 'opacity-60',
      )}
    >
      <span className="text-[11px] font-medium text-white/60">{label}</span>
      <span className="relative [&>select]:w-full [&>select]:appearance-none [&>select]:bg-transparent [&>select]:pr-6 [&>select]:text-sm [&>select]:font-medium [&>select]:text-white [&>select]:outline-none [&_option]:bg-white [&_option]:text-black">
        {children}
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-white/60" />
      </span>
    </label>
  );
}
