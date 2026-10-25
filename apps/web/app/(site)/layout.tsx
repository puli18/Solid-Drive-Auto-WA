import { Outlet, useLoaderData } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { getPublicSettings } from '@/lib/data/public';
import type { LoaderData } from '@/lib/route';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { telHref } from '@/components/site/lib/format';
import './site.css';

export async function loader() {
  return { settings: await getPublicSettings() };
}

export default function SiteLayout() {
  const { settings } = useLoaderData() as LoaderData<typeof loader>;
  const b = settings.business;
  return (
    <>
      <SiteHeader phone={b.phone} telHref={telHref(b.phone)} hours={b.hours} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter settings={settings} />
      <Toaster position="top-center" />
    </>
  );
}
