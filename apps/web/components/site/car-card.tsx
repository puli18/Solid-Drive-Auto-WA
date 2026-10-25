import { Img } from '@/components/img';
import Link from '@/components/link';
import { ArrowUpRight } from 'lucide-react';
import { formatAUD, type PublicCar } from '@sda/shared';
import { carCoverUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { carName, fuelLabel, nf, transmissionLabel } from './lib/format';
import { daysListed, NEW_ARRIVAL_DAYS } from './lib/inventory';

/** Status chip. Reserved/Sold are never colour-only: the word is always shown. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (status === 'available') return null;
  const label = status === 'reserved' ? 'Reserved' : status === 'sold' ? 'Sold' : status;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
        status === 'sold' ? 'bg-brand-red text-white' : 'bg-brand-black text-brand-chrome-light',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', status === 'sold' ? 'bg-white' : 'bg-brand-chrome')} />
      {label}
    </span>
  );
}

export function CarCard({
  car,
  priority,
  sizes = '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw',
  className,
}: {
  car: PublicCar;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const days = daysListed(car);
  const isNew = car.status === 'available' && days !== null && days <= NEW_ARRIVAL_DAYS;
  const alt = car.images?.[0]?.alt || `${carName(car)} ${car.variant ?? ''}`.trim();
  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="sda-zoom bg-brand-stone relative aspect-[4/3] overflow-hidden rounded-xl">
        <Img
          src={carCoverUrl(car.images, 'full')}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <StatusBadge status={car.status} />
          {isNew ? (
            <span className="bg-background/90 text-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur">
              Just in
            </span>
          ) : null}
        </div>
        <span
          aria-hidden
          className="bg-brand-black absolute right-3 bottom-3 grid size-10 place-items-center rounded-full text-white opacity-0 transition-[opacity,transform] duration-300 group-hover:opacity-100 group-focus-within:opacity-100 max-[1023px]:opacity-100"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display sda-num text-2xl font-extrabold tracking-tight" style={{ fontStretch: '110%' }}>
            {formatAUD(car.priceCents)}
          </p>
          <p className="text-muted-foreground font-mono text-[11px]">{car.stockNo}</p>
        </div>
        <h3 className="mt-1 text-base leading-snug font-semibold">
          <Link
            href={`/cars/${car.slug}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none after:focus-visible:ring-2 after:focus-visible:ring-[var(--ring)] after:focus-visible:ring-offset-2"
          >
            {carName(car)}
          </Link>
        </h3>
        <p className="text-muted-foreground line-clamp-1 text-sm">{car.variant}</p>
        <dl className="border-border mt-4 grid grid-cols-3 border-t pt-3 text-[13px]">
          <div>
            <dt className="sr-only">Odometer</dt>
            <dd className="sda-num font-mono">{nf.format(car.km)} km</dd>
          </div>
          <div>
            <dt className="sr-only">Transmission</dt>
            <dd>{transmissionLabel(car.transmission)}</dd>
          </div>
          <div className="text-right">
            <dt className="sr-only">Fuel</dt>
            <dd>{fuelLabel(car.fuel)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
