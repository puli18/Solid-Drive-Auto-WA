import { Suspense } from 'react';
import { CarsList } from '@/components/admin/cars/cars-list';

export default function AdminCarsPage() {
  return (
    <Suspense>
      <CarsList />
    </Suspense>
  );
}
