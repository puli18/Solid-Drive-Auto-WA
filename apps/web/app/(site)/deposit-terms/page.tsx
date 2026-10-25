import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { formatAUD } from '@sda/shared';
import { getPublicSettings } from '@/lib/data/public';
import { LegalPage } from '@/components/site/legal-page';

export const metadata: Metadata = { title: 'Deposit terms', alternates: { canonical: '/deposit-terms' } };

export async function loader() {
  return getPublicSettings();
}

export default function DepositTermsPage() {
  const { legal, deposit } = useLoaderData() as LoaderData<typeof loader>;
  return (
    <LegalPage
      crumb={{ href: '/deposit-terms', label: 'Deposit terms' }}
      title="Deposit terms"
      muted={`${formatAUD(deposit.amountCents)}, non-refundable.`}
      text={legal.depositTermsText || deposit.termsText}
      aside={
        <div className="bg-brand-stone rounded-2xl p-5">
          <p className="font-semibold">In short</p>
          <ul className="text-muted-foreground mt-3 space-y-2">
            <li>The deposit is a fixed {formatAUD(deposit.amountCents)} – no card surcharge.</li>
            <li>It takes the car off the market for you.</li>
            <li>It is non-refundable and comes off the price when you buy.</li>
          </ul>
          <p className="text-muted-foreground mt-4 font-mono text-xs">Terms version {deposit.termsVersion}</p>
        </div>
      }
    />
  );
}
