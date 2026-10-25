import { useLoaderData, useSearchParams } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { getPublicSettings } from '@/lib/data/public';
import { DepositStatus } from '@/components/site/reserve/deposit-status';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = { title: 'Reservation', robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function loader() {
  return getPublicSettings();
}

export default function ReserveSuccessPage() {
  const settings = useLoaderData() as LoaderData<typeof loader>;
  const sp = Object.fromEntries(useSearchParams()[0]) as Record<string, string | undefined>;
  return (
    <>
      <PageHero title="Your reservation" muted="Deposit and next steps." />
      <section className="bg-background py-12 sm:py-16">
        <Container className="max-w-3xl">
          <DepositStatus sessionId={one(sp.session_id)} demo={one(sp.demo) === '1'} phone={settings.business.phone} />
        </Container>
      </section>
    </>
  );
}
