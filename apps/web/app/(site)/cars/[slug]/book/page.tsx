import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { notFound } from '@/lib/navigation';
import { carTitle, isBookable } from '@sda/shared';
import { getCarBySlug, getPublicSettings } from '@/lib/data/public';
import { publicEnv } from '@/lib/env';
import { BookingFlow } from '@/components/site/booking/booking-flow';
import { CarSummary } from '@/components/site/car/car-summary';
import { addressOneLine, telHref } from '@/components/site/lib/format';
import { Container, PageHero } from '@/components/site/primitives';

export async function loader({ params }: LoaderFunctionArgs) {
  const [car, settings] = await Promise.all([getCarBySlug(params.slug ?? ''), getPublicSettings()]);
  if (!car) notFound();
  return { car, settings };
}

export function meta({ car }: LoaderData<typeof loader>): Metadata {
  return {
    title: car ? `Book a test drive – ${carTitle(car)}` : 'Book a test drive',
    robots: { index: false, follow: true },
  };
}

export default function BookPage() {
  const { car, settings } = useLoaderData() as LoaderData<typeof loader>;
  const title = carTitle(car);
  const b = settings.business;
  const bookable = isBookable(car.status, car.published);

  return (
    <>
      <PageHero
        crumbs={[
          { href: '/cars', label: 'Cars for sale' },
          { href: `/cars/${car.slug}`, label: title },
          { href: `/cars/${car.slug}/book`, label: 'Book' },
        ]}
        title="Book a test drive"
        muted="or an inspection."
        intro="Choose a time that suits you. It’s locked in the moment you confirm, and you’ll get an email with a link to change or cancel."
      />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
          <div className="order-2 lg:order-1">
            {bookable ? (
              <BookingFlow
                car={{ id: car.id, slug: car.slug, title }}
                settings={settings.booking}
                timezone={b.timezone}
                location={`${b.name}, ${addressOneLine(b)}`}
                siteUrl={publicEnv.siteUrl}
              />
            ) : (
              <div className="bg-brand-stone rounded-2xl p-8">
                <h2 className="font-display text-2xl font-extrabold">This car can’t be booked right now</h2>
                <p className="text-muted-foreground mt-2">
                  It’s {car.status === 'sold' ? 'been sold' : 'reserved by another buyer'}. Have a look at what else is on the yard, or call us on{' '}
                  <a href={telHref(b.phone)} className="font-medium underline">
                    {b.phone}
                  </a>
                  .
                </p>
                <Link href="/cars" className="sda-press bg-brand-black mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white">
                  Browse cars
                </Link>
              </div>
            )}
          </div>
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-[calc(var(--sda-header-h)+1.5rem)]">
              <CarSummary car={car} />
              <p className="text-muted-foreground mt-4 text-sm">
                Questions first? Call{' '}
                <a href={telHref(b.phone)} className="text-foreground sda-num font-medium">
                  {b.phone}
                </a>
              </p>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
