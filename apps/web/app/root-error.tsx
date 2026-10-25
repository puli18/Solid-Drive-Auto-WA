import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Last-resort error screen (errors outside the site's own error boundary, e.g. a failed chunk load). */
export function RootError() {
  const error = useRouteError();
  console.error(error);
  const status = isRouteErrorResponse(error) ? error.status : null;
  return (
    <main className="bg-brand-black flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <h1 className="font-display text-3xl font-black">{status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="max-w-md text-white/60">Try reloading the page.</p>
      <a href="/" className="bg-brand-red inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">
        Home
      </a>
    </main>
  );
}
