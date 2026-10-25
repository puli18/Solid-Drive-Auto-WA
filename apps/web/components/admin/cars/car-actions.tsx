/**
 * Status / publish quick actions shared by the cars table and the car page header.
 * Every transition goes through `canTransitionCar` (role + readiness); disabled items show the reason.
 * "Mark sold" opens the Sale tab – the sale form sets the status when it is saved.
 */
import { Ban, CheckCircle2, Eye, EyeOff, Loader2, MoreHorizontal, RotateCcw, Tag, Undo2 } from 'lucide-react';
import { useRouter } from '@/lib/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { canTransitionCar, type CarStatus } from '@sda/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type CarRecord, getAdminRepo } from '@/lib/data';
import { useConfirm } from '../confirm';

export function useCarActions() {
  const { role, user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  function check(car: CarRecord, to: CarStatus) {
    return canTransitionCar(car.status, to, { role: role ?? 'staff', car });
  }

  async function changeStatus(car: CarRecord, to: CarStatus): Promise<boolean> {
    if (!user) return false;
    if (to === 'sold') {
      router.push(`/admin/cars/${car.id}?tab=sale`);
      return false;
    }
    const res = check(car, to);
    if (!res.ok) {
      toast.error(res.reason);
      return false;
    }
    if (to === 'withdrawn' && !(await confirm({ title: 'Withdraw this car?', description: 'It is unpublished and hidden from the website. You can re-list it later.', confirmLabel: 'Withdraw' })))
      return false;
    if (car.status === 'reserved' && to === 'available' && !(await confirm({ title: 'Release the reservation?', description: 'The car goes back on sale. Any deposit is NOT refunded by this – handle that in Stripe.', confirmLabel: 'Release' })))
      return false;
    try {
      await getAdminRepo().updateCar(
        car.id,
        {
          status: to,
          ...(to === 'reserved' ? { reservedAt: new Date() } : {}),
          ...(car.status === 'reserved' ? { reservedAt: null } : {}),
          ...(to === 'withdrawn' || to === 'draft' ? { published: false } : {}),
        },
        user.uid,
      );
      toast.success(`${car.stockNo} is now ${to}`);
      return true;
    } catch (e) {
      toast.error(actionErrorMessage(e));
      return false;
    }
  }

  async function setPublished(car: CarRecord, published: boolean): Promise<boolean> {
    if (!user) return false;
    try {
      if (published && car.status === 'draft') {
        const res = check(car, 'available');
        if (!res.ok) {
          toast.error(`Can't publish yet: ${res.reason}`);
          return false;
        }
        await getAdminRepo().updateCar(car.id, { status: 'available', published: true }, user.uid);
      } else if (published && car.status === 'withdrawn') {
        toast.error('Re-list the car (mark available) before publishing.');
        return false;
      } else {
        await getAdminRepo().updateCar(car.id, { published }, user.uid);
      }
      toast.success(published ? `${car.stockNo} is live on the website` : `${car.stockNo} hidden from the website`);
      return true;
    } catch (e) {
      toast.error(actionErrorMessage(e));
      return false;
    }
  }

  return { check, changeStatus, setPublished };
}

export function CarActionsMenu({ car, onChanged, size = 'icon' }: { car: CarRecord; onChanged?: () => void; size?: 'icon' | 'default' }) {
  const { check, changeStatus, setPublished } = useCarActions();
  const [busy, setBusy] = useState(false);

  const run = async (p: Promise<boolean>) => {
    setBusy(true);
    const ok = await p;
    setBusy(false);
    if (ok) onChanged?.();
  };

  const item = (to: CarStatus, label: string, Icon: typeof Tag) => {
    const res = check(car, to);
    if (car.status === to) return null;
    // Only list transitions that exist from this status; show a reason when blocked by readiness/role.
    if (!res.ok && res.reason.startsWith("Can't change status")) return null;
    return (
      <DropdownMenuItem key={to} disabled={!res.ok} onSelect={() => void run(changeStatus(car, to))} className="flex-col items-start gap-0">
        <span className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </span>
        {!res.ok && <span className="text-muted-foreground pl-6 text-xs">{res.reason}</span>}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === 'icon' ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${car.stockNo}`} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        ) : (
          <Button variant="outline" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            Status
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Website</DropdownMenuLabel>
        {car.published ? (
          <DropdownMenuItem onSelect={() => void run(setPublished(car, false))}>
            <EyeOff /> Unpublish
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={car.status === 'withdrawn'} onSelect={() => void run(setPublished(car, true))}>
            <Eye /> Publish
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Status</DropdownMenuLabel>
        {car.status === 'reserved'
          ? item('available', 'Release reservation', Undo2)
          : car.status === 'withdrawn'
            ? item('available', 'Re-list as available', RotateCcw)
            : item('available', 'Mark available', CheckCircle2)}
        {item('reserved', 'Mark reserved', Tag)}
        {item('sold', 'Mark sold…', CheckCircle2)}
        {car.status === 'withdrawn' && item('draft', 'Back to draft', RotateCcw)}
        {item('withdrawn', 'Withdraw', Ban)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
