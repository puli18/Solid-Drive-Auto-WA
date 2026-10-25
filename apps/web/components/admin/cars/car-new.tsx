import { useRouter } from '@/lib/navigation';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { getAdminRepo } from '@/lib/data';
import { useRepo } from '../use-data';
import { PageHeader } from '../ui';
import { CarDetailsForm } from './car-details-form';
import { nextStockNo } from './car-sale';

export function CarNew() {
  const { user } = useAuth();
  const router = useRouter();
  const { data } = useRepo(async (r) => {
    const [cars, app] = await Promise.all([r.listCars({ includeDeleted: true }), r.getSettings('app')]);
    return nextStockNo(cars, app.nextStockNo ?? 1001);
  }, []);

  return (
    <>
      <PageHeader title="Add car" description="Start with the basics – add photos and expenses next." back={{ href: '/admin/cars', label: 'Cars' }} />
      {!data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <CarDetailsForm
          car={null}
          defaultStockNo={data}
          canPublish={false}
          submitLabel="Create car"
          onSubmit={async (values) => {
            const id = await getAdminRepo().createCar({ ...values, published: false, status: 'draft', images: [] }, user!.uid);
            toast.success(`${values.stockNo} created as a draft – add photos to publish it`);
            router.replace(`/admin/cars/${id}?tab=photos`);
          }}
        />
      )}
      {/* Room for the fixed mobile save bar so the last fields can scroll clear of it. */}
      <div aria-hidden className="h-16 md:hidden" />
    </>
  );
}
