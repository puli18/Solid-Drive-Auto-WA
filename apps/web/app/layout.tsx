import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { PreviewBadge } from '@/components/demo/preview-badge';

/** Scroll to `#hash` targets after client-side navigation (ScrollRestoration handles everything else). */
function HashScroll() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView();
  }, [hash, pathname]);
  return null;
}

/** Root layout: wraps the public site and /admin. Fonts and globals.css are loaded in app/main.tsx. */
export default function RootLayout() {
  return (
    <>
      <Outlet />
      <PreviewBadge />
      <ScrollRestoration />
      <HashScroll />
    </>
  );
}
