import { Suspense } from 'react';
import { EnquiriesView } from '@/components/admin/enquiries/enquiries-view';

export default function AdminEnquiriesPage() {
  return (
    <Suspense>
      <EnquiriesView />
    </Suspense>
  );
}
