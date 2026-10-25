import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { getCarBySlug } from '@/lib/data/public';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = { title: 'Reservation cancelled', robots: { index: false, follow: false } };

/** Stripe "cancel_url" landing page. Optional `?car=<slug>` links back to the car. */
export async function loader({ request }: LoaderFunctionArgs) {
  const sp = new URL(request.url).searchParams;
  const slug = sp.get('car') || sp.get('slug');
  return { car: slug ? await getCarBySlug(slug).catch(() => null) : null };
}

export default function ReserveCancelledPage() {
  const { car } = useLoaderData() as LoaderData<typeof loader>;
  return (
    <>
      <PageHero title="No payment taken." muted="Your reservation was cancelled." />
      <section className="bg-background py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="bg-brand-stone rounded-2xl p-6 sm:p-10">
            <p className="text-lg">You left the secure checkout before paying, so nothing was charged and the car hasn’t been reserved.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {car ? (
                <>
                  <Link
                    href={`/cars/${car.slug}/reserve`}
                    className="sda-press bg-brand-red inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white"
                  >
                    Try again
                  </Link>
                  <Link href={`/cars/${car.slug}`} className="sda-press inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold ring-1 ring-black/15">
                    Back to the car
                  </Link>
                </>
              ) : (
                <Link href="/cars" className="sda-press bg-brand-black inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white">
                  Browse cars
                </Link>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
