/**
 * Admin root layout. /admin is client-rendered behind auth and never indexed
 * (public/_headers sends X-Robots-Tag, robots.txt disallows /admin, ADMIN_META sets noindex).
 */
import { Outlet } from 'react-router';
import { AdminProviders } from '@/components/admin/providers';

export default function AdminLayout() {
  return (
    <AdminProviders>
      <Outlet />
    </AdminProviders>
  );
}
