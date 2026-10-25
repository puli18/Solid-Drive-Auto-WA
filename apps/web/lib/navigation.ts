/**
 * Small navigation API over React Router (the app's former next/navigation surface):
 *   useRouter().push/replace(href, { scroll?: false }), usePathname(), useSearchParams(), useParams(), notFound().
 */
import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams as useRouterSearchParams } from 'react-router';

export { redirect, useParams } from 'react-router';

type NavigateOpts = { scroll?: boolean };

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string, opts?: NavigateOpts) => void navigate(href, { preventScrollReset: opts?.scroll === false }),
      replace: (href: string, opts?: NavigateOpts) => void navigate(href, { replace: true, preventScrollReset: opts?.scroll === false }),
      back: () => void navigate(-1),
      forward: () => void navigate(1),
      refresh: () => void navigate('.', { replace: true, preventScrollReset: true }),
    }),
    [navigate],
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}

/** Throw from a loader (or render) to show the not-found page. */
export function notFound(): never {
  throw new Response('Not Found', { status: 404, statusText: 'Not Found' });
}
