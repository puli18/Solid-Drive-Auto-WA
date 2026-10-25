import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { getPublicSettings } from '@/lib/data/public';
import { LegalPage } from '@/components/site/legal-page';

export const metadata: Metadata = { title: 'Website terms', alternates: { canonical: '/terms' } };

export async function loader() {
  return getPublicSettings();
}

export default function TermsPage() {
  const { legal } = useLoaderData() as LoaderData<typeof loader>;
  return <LegalPage crumb={{ href: '/terms', label: 'Website terms' }} title="Website terms" text={legal.termsText} />;
}
