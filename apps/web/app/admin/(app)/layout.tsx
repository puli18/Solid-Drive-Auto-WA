import { Outlet } from 'react-router';
import { AdminShell } from '@/components/admin/shell/admin-shell';

export default function AdminAppLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
