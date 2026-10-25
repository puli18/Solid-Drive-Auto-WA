import Link from '@/components/link';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { PublicCar } from '@sda/shared';
import { CarCard } from '../car-card';

const TABS = [
  { key: 'all', label: 'All', match: () => true, href: '/cars' },
  { key: 'ute', label: 'Utes', match: (c: PublicCar) => c.bodyType === 'ute' || c.bodyType === 'cab-chassis', href: '/cars?body=ute,cab-chassis' },
  { key: 'suv', label: 'SUVs', match: (c: PublicCar) => c.bodyType === 'suv', href: '/cars?body=suv' },
  { key: 'hatch', label: 'Hatches', match: (c: PublicCar) => c.bodyType === 'hatch', href: '/cars?body=hatch' },
] as const;

/** "Latest cars" grid with body-type tabs. `cars` = available cars, newest first. */
export function LatestCars({ cars, total }: { cars: PublicCar[]; total: number }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const reduce = useReducedMotion();
  const active = TABS.find((t) => t.key === tab)!;
  const tabs = TABS.filter((t) => t.key === 'all' || cars.some(t.match));
  const shown = cars.filter(active.match).slice(0, 6);

  return (
    <div>
      <div role="tablist" aria-label="Filter latest cars" className="bg-background inline-flex rounded-full p-1 ring-1 ring-black/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`latest-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="latest-panel"
            onClick={() => setTab(t.key)}
            className="relative h-10 rounded-full px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] aria-selected:text-white aria-[selected=false]:text-black/70 aria-[selected=false]:hover:text-black sm:px-5"
          >
            {tab === t.key ? (
              <motion.span
                layoutId="latest-tab-pill"
                transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.45, bounce: 0.15 }}
                className="bg-brand-black absolute inset-0 rounded-full"
              />
            ) : null}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <div
        id="latest-panel"
        role="tabpanel"
        aria-labelledby={`latest-tab-${tab}`}
        key={tab}
        className="sda-stagger mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shown.map((car) => (
          <CarCard key={car.id} car={car} />
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          href={active.href}
          className="sda-press group bg-brand-black inline-flex h-12 items-center gap-3 rounded-full pr-1.5 pl-6 text-sm font-semibold text-white hover:bg-black"
        >
          {tab === 'all' ? `View all ${total} cars` : `View all ${active.label.toLowerCase()}`}
          <span className="bg-brand-red grid size-9 place-items-center rounded-full transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
      </div>
    </div>
  );
}
