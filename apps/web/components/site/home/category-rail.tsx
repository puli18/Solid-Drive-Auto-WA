import { Img } from '@/components/img';
import Link from '@/components/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';

export interface CategoryItem {
  key: string;
  label: string;
  image: string;
  href: string;
  count: number;
}

/** Horizontally scrolling body-type cards (scroll-snap; arrow buttons for pointer users). */
export function CategoryRail({ items }: { items: CategoryItem[] }) {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    const el = rail.current;
    el?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div>
      <div className="mb-6 hidden justify-end gap-2 sm:flex">
        <RailButton label="Previous categories" disabled={edges.start} onClick={() => scrollBy(-1)}>
          <ArrowLeft className="size-4" />
        </RailButton>
        <RailButton label="Next categories" disabled={edges.end} onClick={() => scrollBy(1)}>
          <ArrowRight className="size-4" />
        </RailButton>
      </div>
      <ul
        ref={rail}
        className="sda-rail -mx-4 flex gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {items.map((c) => (
          <li key={c.key} className="w-[72%] shrink-0 sm:w-[40%] lg:w-[calc((100%-3rem)/4)]">
            <Link
              href={c.href}
              className="group sda-zoom relative block aspect-[3/4] overflow-hidden rounded-xl bg-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            >
              <Img src={c.image} alt="" fill sizes="(min-width: 1024px) 24vw, (min-width: 640px) 40vw, 72vw" className="object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/0 to-black/50" />
              <span className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
                <span>
                  <span className="font-display block text-2xl font-extrabold text-white uppercase" style={{ fontStretch: '118%' }}>
                    {c.label}
                  </span>
                  <span className="mt-1 block text-sm text-white/75">
                    {c.count > 0 ? `${c.count} in stock` : 'Ask us to find one'}
                  </span>
                </span>
              </span>
              <span className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full bg-white text-black transition-colors group-hover:bg-[var(--brand-red)] group-hover:text-white">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RailButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="sda-press grid size-11 place-items-center rounded-full border border-black/15 text-black transition-colors hover:bg-black hover:text-white disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
