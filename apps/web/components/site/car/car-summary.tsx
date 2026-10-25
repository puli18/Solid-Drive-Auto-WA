import { Img } from '@/components/img';
import Link from '@/components/link';
import { formatAUD, type PublicCar } from '@sda/shared';
import { carCoverUrl } from '@/lib/images';
import { carName, formatKm, transmissionLabel } from '../lib/format';

/** Compact car summary used beside the booking and reserve flows. */
export function CarSummary({ car, children }: { car: PublicCar; children?: React.ReactNode }) {
  return (
    <div className="bg-brand-stone overflow-hidden rounded-2xl">
      <div className="relative aspect-[4/3]">
        <Img src={carCoverUrl(car.images, 'full')} alt={carName(car)} fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
      </div>
      <div className="p-5">
        <p className="text-muted-foreground font-mono text-xs">Stock no {car.stockNo}</p>
        <p className="font-display mt-1 text-xl leading-tight font-extrabold" style={{ fontStretch: '108%' }}>
          <Link href={`/cars/${car.slug}`} className="hover:underline">
            {carName(car)}
          </Link>
        </p>
        <p className="text-muted-foreground text-sm">{car.variant}</p>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/10 pt-4">
          <p className="text-muted-foreground text-sm">
            <span className="sda-num font-mono">{formatKm(car.km)}</span> · {transmissionLabel(car.transmission)}
          </p>
          <p className="font-display sda-num text-2xl font-extrabold">{formatAUD(car.priceCents)}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
