import { useLoaderData, useParams, useSearchParams } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { getPublicSettings } from '@/lib/data/public';
import { ManageBooking } from '@/components/site/booking/manage-booking';
import { addressOneLine } from '@/components/site/lib/format';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export async function loader() {
  return getPublicSettings();
}

export default function ManageBookingPage() {
  const settings = useLoaderData() as LoaderData<typeof loader>;
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') ?? '';
  const b = settings.business;
  return (
    <>
      <PageHero title="Your booking" muted="Change or cancel any time." />
      <section className="bg-background py-12 sm:py-16">
        <Container className="max-w-4xl">
          <ManageBooking
            bookingId={decodeURIComponent(id)}
            token={token}
            settings={settings.booking}
            timezone={b.timezone}
            location={`${b.name}, ${addressOneLine(b)}`}
            phone={b.phone}
          />
        </Container>
      </section>
    </>
  );
}
