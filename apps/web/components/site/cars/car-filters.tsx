import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import { useTransition } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { bodyLabel, fuelLabel, transmissionLabel } from '../lib/format';
import { type FilterOptions, SORTS } from '../lib/inventory';

const PRICE_STEPS = [10_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 60_000, 80_000, 100_000];
const KM_STEPS = [20_000, 50_000, 75_000, 100_000, 150_000];
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat('en-AU');

/** Reads/writes the filter query string. Every change updates the URL (shareable, back-button friendly). */
function useQueryState() {
  const router = useRouter();
  const pathname = usePathname() ?? '/cars';
  const sp = useSearchParams() ?? new URLSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') q.delete(k);
      else q.set(k, v);
    }
    start(() => router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false }));
  };
  return { sp, set, pending, clear: () => start(() => router.replace(pathname, { scroll: false })) };
}

export function SortSelect() {
  const { sp, set } = useQueryState();
  return (
    <label className="relative inline-flex items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden sm:inline">Sort</span>
      <span className="relative">
        <select
          aria-label="Sort cars"
          value={sp.get('sort') ?? 'newest'}
          onChange={(e) => set({ sort: e.target.value === 'newest' ? null : e.target.value })}
          className="bg-background h-11 appearance-none rounded-full pr-9 pl-4 text-sm font-medium ring-1 ring-black/12 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-60" />
      </span>
    </label>
  );
}

export function FilterPanel({ options, className }: { options: FilterOptions; className?: string }) {
  const { sp, set, pending, clear } = useQueryState();
  const make = sp.get('make') ?? '';
  const models = make ? (options.modelsByMake[make] ?? []) : [];
  const bodies = (sp.get('body') ?? '').split(',').filter(Boolean);
  const years = [...options.years].sort((a, b) => a - b);

  const toggleBody = (b: string) => {
    const next = bodies.includes(b) ? bodies.filter((x) => x !== b) : [...bodies, b];
    set({ body: next.length ? next.join(',') : null });
  };

  return (
    <div className={cn('space-y-6 transition-opacity', pending && 'opacity-60', className)} aria-busy={pending}>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Make" value={make} onChange={(v) => set({ make: v || null, model: null })} className="col-span-2">
          <option value="">Any make</option>
          {options.makes.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <Select label="Model" value={sp.get('model') ?? ''} onChange={(v) => set({ model: v || null })} disabled={!make} className="col-span-2">
          <option value="">{make ? 'Any model' : 'Choose a make first'}</option>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <Select label="Year from" value={sp.get('yearMin') ?? ''} onChange={(v) => set({ yearMin: v || null })}>
          <option value="">Any</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <Select label="Year to" value={sp.get('yearMax') ?? ''} onChange={(v) => set({ yearMax: v || null })}>
          <option value="">Any</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <Select label="Min price" value={sp.get('priceMin') ?? ''} onChange={(v) => set({ priceMin: v || null })}>
          <option value="">Any</option>
          {PRICE_STEPS.map((p) => (
            <option key={p} value={p}>
              {money.format(p)}
            </option>
          ))}
        </Select>
        <Select label="Max price" value={sp.get('priceMax') ?? ''} onChange={(v) => set({ priceMax: v || null })}>
          <option value="">Any</option>
          {PRICE_STEPS.map((p) => (
            <option key={p} value={p}>
              {money.format(p)}
            </option>
          ))}
        </Select>
        <Select label="Max kilometres" value={sp.get('kmMax') ?? ''} onChange={(v) => set({ kmMax: v || null })} className="col-span-2">
          <option value="">Any</option>
          {KM_STEPS.map((k) => (
            <option key={k} value={k}>
              Under {nf.format(k)} km
            </option>
          ))}
        </Select>
      </div>

      <ChipGroup label="Body type">
        {options.bodies.map((b) => (
          <Chip key={b} active={bodies.includes(b)} onClick={() => toggleBody(b)}>
            {bodyLabel(b)}
          </Chip>
        ))}
        <Chip active={sp.get('drive') === '4x4'} onClick={() => set({ drive: sp.get('drive') === '4x4' ? null : '4x4' })}>
          4x4 / AWD
        </Chip>
      </ChipGroup>

      <ChipGroup label="Transmission">
        {options.transmissions.map((t) => (
          <Chip key={t} active={sp.get('transmission') === t} onClick={() => set({ transmission: sp.get('transmission') === t ? null : t })}>
            {transmissionLabel(t)}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup label="Fuel">
        {options.fuels.map((f) => (
          <Chip key={f} active={sp.get('fuel') === f} onClick={() => set({ fuel: sp.get('fuel') === f ? null : f })}>
            {fuelLabel(f)}
          </Chip>
        ))}
      </ChipGroup>

      <button type="button" onClick={clear} className="text-sm font-semibold underline underline-offset-4">
        Clear all filters
      </button>
    </div>
  );
}

/** Mobile: filters in a bottom sheet. */
export function MobileFilters({ options, activeCount, resultCount }: { options: FilterOptions; activeCount: number; resultCount: number }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="sda-press bg-brand-black inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white lg:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {activeCount ? <span className="bg-brand-red grid size-5 place-items-center rounded-full text-[11px]">{activeCount}</span> : null}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88svh] overflow-y-auto rounded-t-2xl p-0">
        <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4">
          <SheetTitle className="font-display text-xl font-extrabold">Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow down the cars for sale</SheetDescription>
        </div>
        <div className="px-5 py-6">
          <FilterPanel options={options} />
        </div>
        <div className="bg-background sticky bottom-0 border-t px-5 py-4">
          <SheetClose asChild>
            <button type="button" className="sda-press bg-brand-red h-12 w-full rounded-full text-sm font-semibold text-white">
              Show {resultCount} {resultCount === 1 ? 'car' : 'cars'}
            </button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Removable chips for the active filters (above the results). */
export function ActiveFilters({ chips }: { chips: { key: string; label: string; patch: Record<string, string | null> }[] }) {
  const { set, clear } = useQueryState();
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => set(c.patch)}
          className="sda-press bg-brand-stone inline-flex h-9 items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-sm font-medium hover:bg-black/10"
        >
          {c.label}
          <X className="size-3.5 opacity-60" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground px-2 text-sm font-medium underline underline-offset-4">
        Clear all
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  disabled,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', disabled && 'opacity-55', className)}>
      <span className="mb-1.5 block text-xs font-medium text-black/65">{label}</span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background h-11 w-full appearance-none rounded-lg pr-8 pl-3 text-sm font-medium ring-1 ring-black/12 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 opacity-60" />
      </span>
    </label>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-black/65">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'sda-press h-10 rounded-full px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        active ? 'bg-brand-black text-white' : 'bg-background ring-1 ring-black/12 hover:ring-black/30',
      )}
    >
      {children}
    </button>
  );
}
