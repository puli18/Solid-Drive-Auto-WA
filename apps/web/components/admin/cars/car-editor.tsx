/**
 * /admin/cars/[id] – car page with tabs: Details, Photos, Expenses, Financials (admin), Sale, Activity (admin).
 * Admin-only tabs are not rendered at all for staff, so their data is never requested.
 */
import { CarFront, ExternalLink, Globe, RotateCcw, Trash2 } from 'lucide-react';
import Link from '@/components/link';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import { toast } from 'sonner';
import { canTransitionCar, carTitle, type CarFormValues } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type CarRecord, getAdminRepo } from '@/lib/data';
import { useConfirm } from '../confirm';
import { money } from '../format';
import { useRepo } from '../use-data';
import { CarStatusBadge, EmptyState, ErrorState } from '../ui';
import { CarActionsMenu } from './car-actions';
import { CarActivity } from './car-activity';
import { CarDetailsForm } from './car-details-form';
import { CarExpenses } from './car-expenses';
import { CarFinancials } from './car-financials';
import { CarPhotos } from './car-photos';
import { CarSale } from './car-sale';
import { CarThumb } from './car-thumb';

const TABS = ['details', 'photos', 'expenses', 'financials', 'sale', 'activity'] as const;
type Tab = (typeof TABS)[number];
const ADMIN_TABS: Tab[] = ['financials', 'activity'];

export function CarEditor({ id }: { id: string }) {
  const { user, role, isAdmin } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: car, error, loading, reload } = useRepo((r) => r.getCar(id), [id]);

  const requested = (params.get('tab') ?? 'details') as Tab;
  const tab: Tab = TABS.includes(requested) && (isAdmin || !ADMIN_TABS.includes(requested)) ? requested : 'details';
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!car)
    return (
      <EmptyState icon={CarFront} title="Car not found" action={<Button asChild variant="outline"><Link href="/admin/cars">Back to cars</Link></Button>}>
        It may have been deleted, or the link is wrong.
      </EmptyState>
    );

  async function saveDetails(values: Omit<CarFormValues, 'status' | 'images'>, current: CarRecord) {
    let patch: Partial<CarFormValues> = values;
    if (values.published && !current.published) {
      if (current.status === 'withdrawn') {
        toast.error('Re-list the car as available before publishing');
        patch = { ...values, published: false };
      } else if (current.status === 'draft') {
        const res = canTransitionCar('draft', 'available', { role: role ?? 'staff', car: { ...current, ...values } });
        if (res.ok) patch = { ...values, status: 'available' };
        else {
          toast.warning(`Saved, but not published yet: ${res.reason}`);
          patch = { ...values, published: false };
        }
      }
    }
    await getAdminRepo().updateCar(current.id, patch, user!.uid);
    toast.success('Car saved');
    void reload();
  }

  async function softDelete() {
    if (!car || !user) return;
    if (!(await confirm({ title: `Delete ${car.stockNo}?`, description: 'The car is hidden everywhere. An admin can restore it.', confirmLabel: 'Delete car', destructive: true }))) return;
    try {
      await getAdminRepo().softDeleteCar(car.id, user.uid);
      toast.success(`${car.stockNo} deleted`, {
        action: { label: 'Undo', onClick: () => void getAdminRepo().restoreCar(car.id, user.uid).then(() => reload()) },
      });
      router.push('/admin/cars');
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }

  const title = carTitle(car);
  return (
    <>
      <Link href="/admin/cars" className="text-muted-foreground hover:text-foreground mb-2 inline-block text-xs font-medium">
        ← Cars
      </Link>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CarThumb images={car.images} className="w-20 sm:w-24" />
          <div className="min-w-0">
            <h1 className="page-title truncate text-xl font-bold sm:text-2xl">{title}</h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-mono text-xs">{car.stockNo}</span>
              <CarStatusBadge status={car.status} />
              <span className="text-foreground font-semibold tabular-nums">{money(car.priceCents)}</span>
              {car.published ? (
                <span className="text-success inline-flex items-center gap-1 text-xs"><Globe className="size-3.5" /> Live</span>
              ) : (
                <span className="text-xs">Not on website</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {car.published && !car.deletedAt && (
            <Button asChild variant="ghost">
              <a href={`/cars/${car.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink /> View
              </a>
            </Button>
          )}
          {!car.deletedAt && <CarActionsMenu car={car} size="default" onChanged={reload} />}
        </div>
      </div>

      {car.deletedAt ? (
        <EmptyState
          icon={Trash2}
          title="This car was deleted"
          action={
            isAdmin && (
              <Button
                variant="outline"
                onClick={async () => {
                  await getAdminRepo().restoreCar(car.id, user!.uid);
                  toast.success('Car restored');
                  void reload();
                }}
              >
                <RotateCcw /> Restore
              </Button>
            )
          }
        >
          {isAdmin ? 'Restore it to edit again.' : 'Ask an admin to restore it.'}
        </EmptyState>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
            <TabsList className="w-max">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="photos">
                Photos <span className="text-muted-foreground tabular-nums">{car.images.length}</span>
              </TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              {isAdmin && <TabsTrigger value="financials">Financials</TabsTrigger>}
              <TabsTrigger value="sale">Sale</TabsTrigger>
              {isAdmin && <TabsTrigger value="activity">Activity</TabsTrigger>}
            </TabsList>
          </div>
          <div className="pt-4">
            <TabsContent value="details">
              <CarDetailsForm key={car.updatedAt?.getTime()} car={car} submitLabel="Save changes" onSubmit={(v) => saveDetails(v, car)} />
              {isAdmin && (
                <div className="mt-8 mb-16 flex flex-col gap-2 border-t pt-5 sm:flex-row md:mt-10 md:mb-0 sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-sm">Deleting hides the car everywhere. Admins can restore it.</p>
                  <Button variant="outline" className="text-destructive" onClick={() => void softDelete()}>
                    <Trash2 /> Delete car
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="photos">
              <CarPhotos car={car} onSaved={reload} />
            </TabsContent>
            <TabsContent value="expenses">
              <CarExpenses carId={car.id} />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="financials">
                <CarFinancials car={car} />
              </TabsContent>
            )}
            <TabsContent value="sale">
              <CarSale car={car} onChanged={reload} />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="activity">
                <CarActivity carId={car.id} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      )}
    </>
  );
}
