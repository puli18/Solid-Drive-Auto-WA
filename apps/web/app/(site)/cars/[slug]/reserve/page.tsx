import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { notFound } from '@/lib/navigation';
import { carTitle, formatAUD, isBookable } from '@sda/shared';
import { getCarBySlug, getPublicSettings } from '@/lib/data/public';
import { CarSummary } from '@/components/site/car/car-summary';
import { telHref } from '@/components/site/lib/format';
import { ReserveForm } from '@/components/site/reserve/reserve-form';
import { Container, PageHero } from '@/components/site/primitives';

export async function loader({ params }: LoaderFunctionArgs) {
  const [car, settings] = await Promise.all([getCarBySlug(params.slug ?? ''), getPublicSettings()]);
  if (!car) notFound();
  return { car, settings };
}

export function meta({ car }: LoaderData<typeof loader>): Metadata {
  return { title: car ? `Reserve – ${carTitle(car)}` : 'Reserve a car', robots: { index: false, follow: true } };
}

export default function ReservePage() {
  const { car, settings } = useLoaderData() as LoaderData<typeof loader>;
  const title = carTitle(car);
  const deposit = settings.deposit;
  const b = settings.business;
  const canReserve = isBookable(car.status, car.published) && deposit.enabled;

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/cars', label: 'Cars for sale' },
          { href: `/cars/${car.slug}`, label: title },
          { href: `/cars/${car.slug}/reserve`, label: 'Reserve' },
        ]}
        title="Hold it for you."
        muted={`${formatAUD(deposit.amountCents)} deposit.`}
        intro="Pay a fixed holding deposit and the car comes off the market. It’s taken off the price when you complete the purchase."
      />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
          <div className="order-2 lg:order-1">
            {canReserve ? (
              <ReserveForm
                carId={car.id}
                carTitle={title}
                amountCents={deposit.amountCents}
                termsText={deposit.termsText}
                termsVersion={deposit.termsVersion}
              />
            ) : (
              <div className="bg-brand-stone rounded-2xl p-8">
                <h2 className="font-display text-2xl font-extrabold">This car can’t be reserved online</h2>
                <p className="text-muted-foreground mt-2">
                  {car.status === 'available'
                    ? 'Online deposits are switched off at the moment.'
                    : car.status === 'reserved'
                      ? 'Another buyer has already paid a deposit on it.'
                      : 'It has been sold.'}{' '}
                  Call us on{' '}
                  <a href={telHref(b.phone)} className="font-medium underline">
                    {b.phone}
                  </a>{' '}
                  or browse other cars.
                </p>
                <Link href="/cars" className="sda-press bg-brand-black mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white">
                  Browse cars
                </Link>
              </div>
            )}
          </div>
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-[calc(var(--sda-header-h)+1.5rem)]">
              <CarSummary car={car}>
                <dl className="mt-4 space-y-2 border-t border-black/10 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Deposit today</dt>
                    <dd className="sda-num font-semibold">{formatAUD(deposit.amountCents)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Balance on pickup</dt>
                    <dd className="sda-num font-semibold">{formatAUD(Math.max(0, car.priceCents - deposit.amountCents))}</dd>
                  </div>
                </dl>
              </CarSummary>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
