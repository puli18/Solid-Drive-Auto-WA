import { useLoaderData, useSearchParams } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { Search } from 'lucide-react';
import { getPublishedCars, getPublicSettings } from '@/lib/data/public';
import { CarCard } from '@/components/site/car-card';
import { ActiveFilters, FilterPanel, MobileFilters, SortSelect } from '@/components/site/cars/car-filters';
import { bodyLabel, fuelLabel, transmissionLabel } from '@/components/site/lib/format';
import { activeFilterCount, applyFilters, filterOptions, type InventoryFilters, parseFilters } from '@/components/site/lib/inventory';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'Used cars for sale in Perth',
  description: 'Browse quality used cars, utes and SUVs for sale in Perth, WA. Filter by make, price, year and kilometres, then book a test drive online.',
  alternates: { canonical: '/cars' },
};

const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat('en-AU');

function chipsFor(f: InventoryFilters) {
  const chips: { key: string; label: string; patch: Record<string, string | null> }[] = [];
  if (f.make) chips.push({ key: 'make', label: f.make, patch: { make: null, model: null } });
  if (f.model) chips.push({ key: 'model', label: f.model, patch: { model: null } });
  if (f.yearMin) chips.push({ key: 'yearMin', label: `From ${f.yearMin}`, patch: { yearMin: null } });
  if (f.yearMax) chips.push({ key: 'yearMax', label: `Up to ${f.yearMax}`, patch: { yearMax: null } });
  if (f.priceMin) chips.push({ key: 'priceMin', label: `Over ${money.format(f.priceMin)}`, patch: { priceMin: null } });
  if (f.priceMax) chips.push({ key: 'priceMax', label: `Under ${money.format(f.priceMax)}`, patch: { priceMax: null } });
  if (f.kmMax) chips.push({ key: 'kmMax', label: `Under ${nf.format(f.kmMax)} km`, patch: { kmMax: null } });
  for (const b of f.body ?? []) {
    const rest = (f.body ?? []).filter((x) => x !== b);
    chips.push({ key: `body-${b}`, label: bodyLabel(b), patch: { body: rest.length ? rest.join(',') : null } });
  }
  if (f.drive) chips.push({ key: 'drive', label: '4x4 / AWD', patch: { drive: null } });
  if (f.transmission) chips.push({ key: 'tr', label: transmissionLabel(f.transmission), patch: { transmission: null } });
  if (f.fuel) chips.push({ key: 'fuel', label: fuelLabel(f.fuel), patch: { fuel: null } });
  return chips;
}

export async function loader() {
  return Promise.all([getPublishedCars().catch(() => []), getPublicSettings()]);
}

export default function CarsPage() {
  const [all, settings] = useLoaderData() as LoaderData<typeof loader>;
  const [searchParams] = useSearchParams();
  const sp = Object.fromEntries(searchParams);
  const filters = parseFilters(sp);
  const results = applyFilters(all, filters);
  const options = filterOptions(all);
  const active = activeFilterCount(filters);

  return (
    <>
      <PageHero
        crumbs={[{ href: '/cars', label: 'Cars for sale' }]}
        title="Cars for sale"
        muted={`${all.length} on the yard in ${settings.business.address.suburb}.`}
        intro="Every listing shows the real car, its kilometres and stock number. Filter, compare, then book a test drive in a live time slot."
      />

      <section className="bg-background py-10 sm:py-14">
        <Container className="grid gap-10 lg:grid-cols-[17rem_1fr]">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-[calc(var(--sda-header-h)+1.5rem)]">
              <h2 className="font-display mb-5 text-lg font-extrabold">Filter cars</h2>
              <FilterPanel options={options} />
            </div>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm" aria-live="polite">
                <span className="sda-num font-semibold">{results.length}</span>{' '}
                <span className="text-muted-foreground">{results.length === 1 ? 'car' : 'cars'} found</span>
              </p>
              <div className="flex items-center gap-2">
                <MobileFilters options={options} activeCount={active} resultCount={results.length} />
                <SortSelect />
              </div>
            </div>
            <div className="mt-4">
              <ActiveFilters chips={chipsFor(filters)} />
            </div>

            {results.length ? (
              <ul className="sda-stagger mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((car, i) => (
                  <li key={car.id}>
                    <CarCard car={car} priority={i < 2} sizes="(min-width: 1280px) 26vw, (min-width: 640px) 45vw, 92vw" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-brand-stone mt-8 flex flex-col items-start rounded-2xl p-8 sm:p-12">
                <span className="bg-background grid size-12 place-items-center rounded-full">
                  <Search className="size-5" aria-hidden />
                </span>
                <h2 className="font-display mt-5 text-2xl font-extrabold sm:text-3xl" style={{ fontStretch: '110%' }}>
                  No cars match those filters
                </h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Try removing a filter or widening the price range. Or tell us what you’re after and we’ll let you know when one arrives.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/cars" className="sda-press bg-brand-black inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white">
                    Clear filters
                  </Link>
                  <Link href="/contact" className="sda-press inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold ring-1 ring-black/15">
                    Ask us to find one
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
