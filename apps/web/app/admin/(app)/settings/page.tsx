import { Suspense } from 'react';
import { SettingsView } from '@/components/admin/settings/settings-view';

export default function AdminSettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
