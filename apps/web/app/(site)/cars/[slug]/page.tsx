import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import { type Metadata, useJsonLd } from '@/lib/meta';
import Link from '@/components/link';
import { notFound } from '@/lib/navigation';
import { ArrowRight, CalendarCheck, Check, Lock } from 'lucide-react';
import { carTitle, formatAUD, isBookable, type PublicCar, sortCarImages } from '@sda/shared';
import { getCarBySlug, getPublishedCars, getPublicSettings } from '@/lib/data/public';
import { absoluteCarImageUrl, carImageUrl } from '@/lib/images';
import { publicEnv } from '@/lib/env';
import { CarCard, StatusBadge } from '@/components/site/car-card';
import { CarGallery } from '@/components/site/car/gallery';
import { EnquireDialog } from '@/components/site/car/enquire-dialog';
import { FinanceCalculator } from '@/components/site/finance-calculator';
import { bodyLabel, carName, formatKm, fuelLabel, paragraphs, transmissionLabel } from '@/components/site/lib/format';
import { similarCars } from '@/components/site/lib/inventory';
import { Container, Crumbs, Headline } from '@/components/site/primitives';

export async function loader({ params }: LoaderFunctionArgs) {
  const [car, settings, all] = await Promise.all([getCarBySlug(params.slug ?? ''), getPublicSettings(), getPublishedCars().catch(() => [])]);
  if (!car) notFound();
  return { car, settings, all };
}

export function meta({ car }: LoaderData<typeof loader>): Metadata {
  const title = `${carTitle(car)} – ${formatAUD(car.priceCents)}`;
  const description = `${carTitle(car)} for sale in Perth: ${formatKm(car.km)}, ${transmissionLabel(car.transmission).toLowerCase()}, ${fuelLabel(car.fuel).toLowerCase()}. Stock no ${car.stockNo}. Book a test drive online.`;
  const cover = sortCarImages(car.images ?? [])[0];
  const image = cover ? absoluteCarImageUrl(cover.id, 'full') : `${publicEnv.siteUrl}/images/og/default.webp`;
  return {
    title,
    description,
    alternates: { canonical: `/cars/${car.slug}` },
    openGraph: { type: 'website', title, description, url: `/cars/${car.slug}`, images: [{ url: image, alt: carTitle(car) }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

function carJsonLd(car: PublicCar, dealer: { name: string; phone: string; address: string }) {
  const images = sortCarImages(car.images ?? []).map((i) => absoluteCarImageUrl(i.id, 'full'));
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: carTitle(car),
    url: `${publicEnv.siteUrl}/cars/${car.slug}`,
    image: images,
    brand: { '@type': 'Brand', name: car.make },
    model: car.model,
    vehicleConfiguration: car.variant || undefined,
    vehicleModelDate: String(car.year),
    bodyType: bodyLabel(car.bodyType),
    color: car.colour || undefined,
    fuelType: fuelLabel(car.fuel),
    vehicleTransmission: transmissionLabel(car.transmission),
    vehicleEngine: car.engine ? { '@type': 'EngineSpecification', name: car.engine } : undefined,
    vehicleIdentificationNumber: car.vin || undefined,
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: car.km, unitCode: 'KMT' },
    itemCondition: 'https://schema.org/UsedCondition',
    sku: car.stockNo,
    description: car.description || undefined,
    offers: {
      '@type': 'Offer',
      price: (car.priceCents / 100).toFixed(2),
      priceCurrency: 'AUD',
      url: `${publicEnv.siteUrl}/cars/${car.slug}`,
      availability:
        car.status === 'available'
          ? 'https://schema.org/InStock'
          : car.status === 'reserved'
            ? 'https://schema.org/LimitedAvailability'
            : 'https://schema.org/SoldOut',
      seller: { '@type': 'AutoDealer', name: dealer.name, telephone: dealer.phone, address: dealer.address },
    },
  };
}

export default function CarPage() {
  const { car, settings, all } = useLoaderData() as LoaderData<typeof loader>;

  const b = settings.business;
  const title = carTitle(car);
  const bookable = isBookable(car.status, car.published);
  const canReserve = bookable && settings.deposit.enabled;
  const images = sortCarImages(car.images ?? []).map((img, i) => ({
    src: carImageUrl(img.id, 'full'),
    alt: img.alt || `${title} – photo ${i + 1}`,
  }));
  const gallery = images.length ? images : [{ src: '/placeholder-car.svg', alt: `${title} – photo coming soon` }];
  const similar = similarCars(all, car, 3);
  const specs: [string, React.ReactNode][] = [
    ['Year', car.year],
    ['Make', car.make],
    ['Model', car.model],
    ['Variant', car.variant || '—'],
    ['Body', bodyLabel(car.bodyType)],
    ['Odometer', <span key="km" className="sda-num font-mono">{formatKm(car.km)}</span>],
    ['Transmission', transmissionLabel(car.transmission)],
    ['Fuel', fuelLabel(car.fuel)],
    ['Engine', car.engine || '—'],
    ['Colour', car.colour || '—'],
    ['Stock no', <span key="stock" className="font-mono">{car.stockNo}</span>],
  ];
  if (car.rego) specs.push(['Rego', <span key="rego" className="font-mono">{car.rego}</span>]);
  if (car.vin) specs.push(['VIN', <span key="vin" className="font-mono text-xs break-all sm:text-sm">{car.vin}</span>]);

  const jsonLd = carJsonLd(car, { name: b.name, phone: b.phone, address: `${b.address.line1}, ${b.address.suburb} ${b.address.state} ${b.address.postcode}` });
  useJsonLd(jsonLd);

  return (
    <>
      <section className="dark bg-brand-black text-foreground">
        <Container className="pt-[calc(var(--sda-header-h)+1.5rem)] pb-12 sm:pb-16">
          <Crumbs items={[{ href: '/cars', label: 'Cars for sale' }, { href: `/cars/${car.slug}`, label: title }]} />
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-12">
            <CarGallery images={gallery} title={title} />

            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={car.status} className={car.status === 'reserved' ? 'bg-brand-chrome-light text-brand-black' : undefined} />
                <span className="text-muted-foreground font-mono text-xs">Stock no {car.stockNo}</span>
              </div>
              <h1 className="font-display mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1] font-extrabold tracking-[-0.025em] text-white" style={{ fontStretch: '110%' }}>
                {carName(car)}
              </h1>
              {car.variant ? <p className="text-muted-foreground mt-2 text-lg">{car.variant}</p> : null}

              <p className="font-display sda-num mt-6 text-5xl font-black text-white" style={{ fontStretch: '112%' }}>
                {formatAUD(car.priceCents)}
              </p>

              <ul className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 text-sm">
                <KeySpec label="Odometer" value={<span className="sda-num font-mono">{formatKm(car.km)}</span>} />
                <KeySpec label="Gearbox" value={transmissionLabel(car.transmission)} />
                <KeySpec label="Fuel" value={fuelLabel(car.fuel)} />
                <KeySpec label="Body" value={bodyLabel(car.bodyType)} />
              </ul>

              <div className="mt-8 space-y-3">
                {bookable ? (
                  <>
                    <Link
                      href={`/cars/${car.slug}/book`}
                      className="sda-press bg-brand-red hover:bg-brand-red-hover flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-white"
                    >
                      <CalendarCheck className="size-5" aria-hidden />
                      Book a test drive or inspection
                    </Link>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {canReserve ? (
                        <Link
                          href={`/cars/${car.slug}/reserve`}
                          className="sda-press bg-brand-chrome-light text-brand-black flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold hover:bg-white"
                        >
                          <Lock className="size-4" aria-hidden />
                          Reserve with {formatAUD(settings.deposit.amountCents)}
                        </Link>
                      ) : null}
                      <EnquireDialog carId={car.id} carTitle={title} className={canReserve ? '' : 'sm:col-span-2'} />
                    </div>
                    {canReserve ? (
                      <p className="text-muted-foreground text-xs">
                        The deposit is non-refundable and comes off the price.{' '}
                        <Link href="/deposit-terms" className="underline underline-offset-4">
                          Deposit terms
                        </Link>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-white/[0.06] p-4 text-sm">
                      <p className="font-semibold text-white">{car.status === 'reserved' ? 'This car is reserved' : 'This car has been sold'}</p>
                      <p className="text-muted-foreground mt-1">
                        {car.status === 'reserved'
                          ? 'A deposit has been paid on this car. Send an enquiry and we’ll let you know if it becomes available again.'
                          : 'It’s found a new home. Have a look at the similar cars below, or ask us to find you another one.'}
                      </p>
                    </div>
                    <EnquireDialog
                      carId={car.id}
                      carTitle={title}
                      className="w-full text-white"
                      label={car.status === 'sold' ? 'Ask about similar cars' : 'Enquire'}
                      defaultMessage={
                        car.status === 'sold'
                          ? `Hi, I saw the ${title} has sold. Do you have anything similar?`
                          : `Hi, I’m interested in the ${title}. Please let me know if it becomes available.`
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-background py-14 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-12">
          <div className="space-y-14">
            {car.description ? (
              <div>
                <h2 className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
                  About this car
                </h2>
                <div className="sda-prose text-muted-foreground mt-4 max-w-[68ch] text-base">
                  {paragraphs(car.description).map((p) => (
                    <p key={p.slice(0, 40)}>{p}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h2 className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
                Specifications
              </h2>
              <dl className="mt-4 divide-y border-y">
                {specs.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-3 text-sm sm:grid-cols-[12rem_1fr]">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {car.features?.length ? (
              <div>
                <h2 className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
                  Features
                </h2>
                <ul className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {car.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="text-brand-red mt-0.5 size-4 shrink-0" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <aside aria-label="Finance estimate">
            <div className="lg:sticky lg:top-[calc(var(--sda-header-h)+1.5rem)]">
              <h2 className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
                Estimate repayments
              </h2>
              <p className="text-muted-foreground mt-1 mb-4 text-sm">Pre-filled with this car’s price.</p>
              <FinanceCalculator compact priceCents={car.priceCents} ratePct={settings.finance.indicativeRatePct} disclaimer={settings.finance.disclaimer} />
            </div>
          </aside>
        </Container>
      </section>

      {similar.length ? (
        <section className="bg-brand-stone py-16 sm:py-24">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Headline lead="Similar cars" muted="on the yard now." size="md" />
              <Link href="/cars" className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
                All cars <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((c) => (
                <li key={c.id}>
                  <CarCard car={c} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {bookable ? <div aria-hidden className="h-[4.5rem] sm:hidden" /> : null}
      {bookable ? (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-black/60">{carName(car)}</p>
              <p className="font-display sda-num text-xl font-extrabold">{formatAUD(car.priceCents)}</p>
            </div>
            <Link
              href={`/cars/${car.slug}/book`}
              className="sda-press bg-brand-red flex h-12 items-center rounded-full px-5 text-sm font-semibold text-white"
            >
              Book test drive
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

function KeySpec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="bg-brand-graphite p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </li>
  );
}
