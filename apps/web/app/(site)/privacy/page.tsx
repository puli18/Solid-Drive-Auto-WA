import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { getPublicSettings } from '@/lib/data/public';
import { LegalPage } from '@/components/site/legal-page';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export async function loader() {
  return getPublicSettings();
}

export default function PrivacyPage() {
  const { legal } = useLoaderData() as LoaderData<typeof loader>;
  return <LegalPage crumb={{ href: '/privacy', label: 'Privacy policy' }} title="Privacy policy" text={legal.privacyText} />;
}
