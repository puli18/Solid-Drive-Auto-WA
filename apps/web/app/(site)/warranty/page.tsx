import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { getPublicSettings } from '@/lib/data/public';
import { LegalPage } from '@/components/site/legal-page';
import { telHref } from '@/components/site/lib/format';

export const metadata: Metadata = {
  title: 'Warranty',
  description: 'Warranty information for used cars bought from Solid Drive Auto WA.',
  alternates: { canonical: '/warranty' },
};

export async function loader() {
  return getPublicSettings();
}

export default function WarrantyPage() {
  const { legal, business: b } = useLoaderData() as LoaderData<typeof loader>;
  return (
    <LegalPage
      crumb={{ href: '/warranty', label: 'Warranty' }}
      title="Warranty"
      muted="Peace of mind after pickup."
      text={legal.warrantyText}
      aside={
        <div className="bg-brand-stone rounded-2xl p-5">
          <p className="font-semibold">Questions about a specific car?</p>
          <p className="text-muted-foreground mt-2">
            Warranty can differ by age and kilometres. Ask us about the car you’re looking at before you buy.
          </p>
          <a href={telHref(b.phone)} className="sda-num mt-4 block text-lg font-semibold">
            {b.phone}
          </a>
          <Link href="/contact" className="mt-1 inline-block underline underline-offset-4">
            Send an enquiry
          </Link>
        </div>
      }
    >
      <p className="text-muted-foreground mt-8 border-t pt-6 text-sm">
        Your rights under the Australian Consumer Law are not affected by any warranty we offer.
      </p>
    </LegalPage>
  );
}
