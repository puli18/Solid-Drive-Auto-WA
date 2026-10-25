/**
 * Route table (React Router data mode). Every route module is lazy-loaded, so the public site and
 * /admin end up in separate chunks. File layout mirrors the former Next.js app/ directory.
 */
import { createBrowserRouter } from 'react-router';
import { ADMIN_META } from '@/lib/meta';
import { layout, page } from '@/lib/route';
import RootLayout from './layout';
import { RootError } from './root-error';

const admin = (load: Parameters<typeof page>[0]) => page(load, ADMIN_META);

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RootError />,
    hydrateFallbackElement: <div className="min-h-svh" />,
    children: [
      // ---------------- Public site ----------------
      {
        id: 'site',
        lazy: layout(() => import('./(site)/layout')),
        children: [
          {
            // Errors (and loader 404s) render inside the site layout.
            lazy: async () => ({ ErrorBoundary: (await import('./(site)/error')).default }),
            children: [
              { index: true, lazy: page(() => import('./(site)/page')) },
              { path: 'cars', lazy: page(() => import('./(site)/cars/page')) },
              { path: 'cars/:slug', lazy: page(() => import('./(site)/cars/[slug]/page')) },
              { path: 'cars/:slug/book', lazy: page(() => import('./(site)/cars/[slug]/book/page')) },
              { path: 'cars/:slug/reserve', lazy: page(() => import('./(site)/cars/[slug]/reserve/page')) },
              { path: 'booking/:id', lazy: page(() => import('./(site)/booking/[id]/page')) },
              { path: 'reserve/success', lazy: page(() => import('./(site)/reserve/success/page')) },
              { path: 'reserve/cancelled', lazy: page(() => import('./(site)/reserve/cancelled/page')) },
              { path: 'about', lazy: page(() => import('./(site)/about/page')) },
              { path: 'contact', lazy: page(() => import('./(site)/contact/page')) },
              { path: 'deposit-terms', lazy: page(() => import('./(site)/deposit-terms/page')) },
              { path: 'faq', lazy: page(() => import('./(site)/faq/page')) },
              { path: 'finance', lazy: page(() => import('./(site)/finance/page')) },
              { path: 'privacy', lazy: page(() => import('./(site)/privacy/page')) },
              { path: 'terms', lazy: page(() => import('./(site)/terms/page')) },
              { path: 'trade-in', lazy: page(() => import('./(site)/trade-in/page')) },
              { path: 'warranty', lazy: page(() => import('./(site)/warranty/page')) },
              // Unknown public URLs render the not-found page inside the site layout.
              { path: '*', lazy: page(() => import('./(site)/not-found')) },
            ],
          },
        ],
      },
      // ---------------- Admin (client-only, behind auth, never indexed) ----------------
      {
        path: 'admin',
        lazy: layout(() => import('./admin/layout')),
        children: [
          { path: 'login', lazy: admin(() => import('./admin/login/page')) },
          {
            lazy: layout(() => import('./admin/(app)/layout')),
            children: [
              { index: true, lazy: admin(() => import('./admin/(app)/page')) },
              { path: 'bookings', lazy: admin(() => import('./admin/(app)/bookings/page')) },
              { path: 'cars', lazy: admin(() => import('./admin/(app)/cars/page')) },
              { path: 'cars/new', lazy: admin(() => import('./admin/(app)/cars/new/page')) },
              { path: 'cars/:id', lazy: admin(() => import('./admin/(app)/cars/[id]/page')) },
              { path: 'deposits', lazy: admin(() => import('./admin/(app)/deposits/page')) },
              { path: 'enquiries', lazy: admin(() => import('./admin/(app)/enquiries/page')) },
              { path: 'receipts/*', lazy: admin(() => import('./admin/(app)/receipts/[...path]/page')) },
              { path: 'reports', lazy: admin(() => import('./admin/(app)/reports/page')) },
              { path: 'sales', lazy: admin(() => import('./admin/(app)/sales/page')) },
              { path: 'settings', lazy: admin(() => import('./admin/(app)/settings/page')) },
              { path: 'users', lazy: admin(() => import('./admin/(app)/users/page')) },
              { path: 'vendors', lazy: admin(() => import('./admin/(app)/vendors/page')) },
            ],
          },
        ],
      },
    ],
  },
]);
