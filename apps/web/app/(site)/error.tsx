import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { useEffect } from 'react';
import Link from '@/components/link';
import { useDocumentMeta } from '@/lib/meta';
import { Container, Headline } from '@/components/site/primitives';
import NotFound, { metadata as notFoundMeta } from './not-found';

/** Site error boundary (route errorElement): 404 responses show the not-found page, anything else a retry screen. */
export default function SiteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return notFound ? <NotFoundBoundary /> : <ErrorScreen error={error} />;
}

function NotFoundBoundary() {
  useDocumentMeta(notFoundMeta);
  return <NotFound />;
}

function ErrorScreen({ error }: { error: unknown }) {
  const navigate = useNavigate();
  useDocumentMeta({ title: 'Something went wrong', robots: { index: false } });
  useEffect(() => {
    console.error(error);
  }, [error]);
  const reset = () => void navigate('.', { replace: true });
  return (
    <section className="dark bg-brand-black text-foreground">
      <Container className="flex min-h-[70svh] flex-col justify-center pt-[calc(var(--sda-header-h)+3rem)] pb-20">
        <Headline as="h1" lead="Something stalled." muted="Let’s try that again." mutedClassName="text-white/45" />
        <p className="text-muted-foreground mt-5 max-w-md">This page didn’t load properly. Try again, or head back to the cars.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="sda-press bg-brand-red inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white">
            Try again
          </button>
          <Link href="/cars" className="sda-press inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white ring-1 ring-white/25">
            Browse cars
          </Link>
        </div>
      </Container>
    </section>
  );
}
