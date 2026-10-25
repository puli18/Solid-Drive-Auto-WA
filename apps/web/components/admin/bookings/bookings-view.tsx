/** /admin/bookings – day / week calendar and list, create booking, attended / no-show / cancel. */
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Phone, Plus } from 'lucide-react';
import Link from '@/components/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  addDaysToDateKey,
  BOOKING_STATUS_LABELS,
  BOOKING_TYPE_LABELS,
  type BookingStatus,
  canTransitionBooking,
  formatInTz,
  weekdayOfDateKey,
  WEEKDAYS,
} from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type BookingRecord, getAdminRepo } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useConfirm } from '../confirm';
import { dateKey, dateTimeAU, timeAU, today, TZ } from '../format';
import { FormSheet } from '../form-sheet';
import { useRepo } from '../use-data';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, ToneBadge } from '../ui';
import { CreateBookingSheet } from './create-booking-sheet';

type View = 'day' | 'week' | 'list';
const STATUS_TONE: Record<BookingStatus, 'info' | 'neutral' | 'success' | 'danger'> = {
  confirmed: 'info',
  cancelled: 'neutral',
  attended: 'success',
  'no-show': 'danger',
};
const keyToDate = (k: string) => new Date(`${k}T12:00:00+08:00`);

function BookingCard({ b, onOpen, compact }: { b: BookingRecord; onOpen: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'bg-card hover:bg-accent/50 w-full rounded-lg border px-3 py-2 text-left transition-colors',
        b.status === 'cancelled' && 'opacity-55',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{timeAU(b.startAt)}</span>
        {!compact && <ToneBadge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</ToneBadge>}
      </div>
      <div className={cn('truncate text-sm', b.status === 'cancelled' && 'line-through')}>{b.customer.name}</div>
      <div className="text-muted-foreground truncate text-xs">
        {BOOKING_TYPE_LABELS[b.type]} · {b.stockNo ?? ''} {compact ? '' : b.carTitle}
      </div>
      {compact && b.status !== 'confirmed' && <div className="text-muted-foreground mt-0.5 text-[11px]">{BOOKING_STATUS_LABELS[b.status]}</div>}
    </button>
  );
}

function BookingSheet({ booking, onClose, onChanged }: { booking: BookingRecord | null; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  if (booking && booking.id !== lastId) {
    setLastId(booking.id);
    setNotes(booking.notes ?? '');
  }

  async function update(patch: { status?: BookingStatus; notes?: string }, label: string, key: string) {
    if (!booking || !user) return;
    if (patch.status === 'cancelled' && !(await confirm({ title: 'Cancel this booking?', description: 'The slot is released. Let the customer know – cancellations from here don’t email them in the preview.', confirmLabel: 'Cancel booking', destructive: true })))
      return;
    setBusy(key);
    try {
      await getAdminRepo().updateBooking(booking.id, patch, user.uid);
      toast.success(label);
      onChanged();
      if (patch.status) onClose();
    } catch (e) {
      toast.error(actionErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const b = booking;
  return (
    <FormSheet
      open={!!b}
      onOpenChange={(o) => !o && onClose()}
      title={b ? `${BOOKING_TYPE_LABELS[b.type]} · ${b.customer.name}` : ''}
      description={b ? dateTimeAU(b.startAt) : undefined}
      footer={
        b && (
          <div className="grid w-full grid-cols-3 gap-2">
            {(['attended', 'no-show', 'cancelled'] as const).map((s) => (
              <Button
                key={s}
                variant={s === 'cancelled' ? 'outline' : s === 'attended' ? 'default' : 'secondary'}
                className={s === 'cancelled' ? 'text-destructive' : undefined}
                disabled={!canTransitionBooking(b.status, s) || b.status === s || !!busy}
                onClick={() => void update({ status: s }, s === 'cancelled' ? 'Booking cancelled' : `Marked ${BOOKING_STATUS_LABELS[s].toLowerCase()}`, s)}
              >
                {busy === s && <Loader2 className="animate-spin" />}
                {s === 'cancelled' ? 'Cancel' : BOOKING_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        )
      }
    >
      {b && (
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-2">
            <ToneBadge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</ToneBadge>
            <span className="text-muted-foreground text-xs">{b.source === 'staff' ? 'Booked by staff' : 'Booked online'}</span>
          </div>
          <dl className="grid grid-cols-[96px_1fr] gap-y-2">
            <dt className="text-muted-foreground">Car</dt>
            <dd>
              <Link href={`/admin/cars/${b.carId}`} className="underline-offset-4 hover:underline">
                {b.carTitle} <span className="text-muted-foreground font-mono text-xs">{b.stockNo}</span>
              </Link>
            </dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>
              <a href={`tel:${b.customer.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                <Phone className="size-3.5" /> {b.customer.phone}
              </a>
            </dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">
              <a href={`mailto:${b.customer.email}`} className="underline-offset-4 hover:underline">{b.customer.email}</a>
            </dd>
            {b.type === 'test-drive' && (
              <>
                <dt className="text-muted-foreground">Licence</dt>
                <dd>{b.licenceConfirmed ? 'Confirmed by customer' : 'Not confirmed'}</dd>
              </>
            )}
          </dl>
          <div className="space-y-2">
            <Label htmlFor="booking-notes">Notes</Label>
            <Textarea id="booking-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={notes === (b.notes ?? '') || !!busy} onClick={() => void update({ notes }, 'Notes saved', 'notes')}>
                Save notes
              </Button>
            </div>
          </div>
        </div>
      )}
    </FormSheet>
  );
}

export function BookingsView() {
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(today());
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const { data, error, loading, reload } = useRepo(async (r) => {
    const [bookings, cars] = await Promise.all([r.listBookings(), r.listCars()]);
    return { bookings, cars };
  }, []);

  const weekStart = useMemo(() => addDaysToDateKey(date, -WEEKDAYS.indexOf(weekdayOfDateKey(date))), [date]);
  const byDay = useMemo(() => {
    const m = new Map<string, BookingRecord[]>();
    for (const b of data?.bookings ?? []) {
      const k = dateKey(b.startAt);
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [data]);

  const step = view === 'week' ? 7 : 1;
  const open = data?.bookings.find((b) => b.id === openId) ?? null;
  const t = today();

  const label =
    view === 'week'
      ? `${formatInTz(keyToDate(weekStart), 'd MMM', TZ)} – ${formatInTz(keyToDate(addDaysToDateKey(weekStart, 6)), 'd MMM yyyy', TZ)}`
      : formatInTz(keyToDate(date), date === t ? "'Today,' d MMM" : 'EEE d MMM yyyy', TZ);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Test drives and inspections"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New booking
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)} className="w-full sm:w-auto">
          <ToggleGroupItem value="day" className="flex-1 px-4">Day</ToggleGroupItem>
          <ToggleGroupItem value="week" className="flex-1 px-4">Week</ToggleGroupItem>
          <ToggleGroupItem value="list" className="flex-1 px-4">List</ToggleGroupItem>
        </ToggleGroup>
        {view !== 'list' ? (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous" onClick={() => setDate(addDaysToDateKey(date, -step))}>
              <ChevronLeft />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-0 flex-1 font-medium sm:w-56">
                  <CalendarDays /> {label}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={keyToDate(date)} onSelect={(d) => d && setDate(dateKey(d))} weekStartsOn={1} />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" aria-label="Next" onClick={() => setDate(addDaysToDateKey(date, step))}>
              <ChevronRight />
            </Button>
            {date !== t && (
              <Button variant="ghost" onClick={() => setDate(t)}>
                Today
              </Button>
            )}
          </div>
        ) : (
          <ToggleGroup type="single" size="sm" value={listFilter} onValueChange={(v) => v && setListFilter(v as typeof listFilter)}>
            <ToggleGroupItem value="upcoming" className="px-3">Upcoming</ToggleGroupItem>
            <ToggleGroupItem value="past" className="px-3">Past</ToggleGroupItem>
            <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : view === 'day' ? (
        (() => {
          const list = byDay.get(date) ?? [];
          return list.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No bookings this day" action={<Button variant="outline" onClick={() => setCreating(true)}><Plus /> New booking</Button>} />
          ) : (
            <ol className="space-y-2">
              {list.map((b) => (
                <li key={b.id} className="grid grid-cols-[64px_1fr] gap-3">
                  <span className="text-muted-foreground pt-2 text-right text-xs tabular-nums">{timeAU(b.startAt)}</span>
                  <BookingCard b={b} onOpen={() => setOpenId(b.id)} />
                </li>
              ))}
            </ol>
          );
        })()
      ) : view === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const k = addDaysToDateKey(weekStart, i);
            const list = byDay.get(k) ?? [];
            const isToday = k === t;
            return (
              <section key={k} className={cn('min-h-0 rounded-lg border p-2 md:min-h-56', isToday && 'border-foreground/40')}>
                <button type="button" onClick={() => { setDate(k); setView('day'); }} className="mb-2 flex w-full items-baseline justify-between text-left">
                  <span className={cn('text-xs font-medium uppercase', isToday ? 'text-primary' : 'text-muted-foreground')}>{formatInTz(keyToDate(k), 'EEE', TZ)}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatInTz(keyToDate(k), 'd', TZ)}</span>
                </button>
                <div className="space-y-1.5">
                  {list.length === 0 ? <p className="text-muted-foreground hidden text-center text-xs md:block">–</p> : list.map((b) => <BookingCard key={b.id} b={b} compact onOpen={() => setOpenId(b.id)} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        (() => {
          const now = Date.now();
          const list = data.bookings
            .filter((b) => (listFilter === 'all' ? true : listFilter === 'upcoming' ? +b.endAt >= now : +b.endAt < now))
            .sort((a, b) => (listFilter === 'past' ? +b.startAt - +a.startAt : +a.startAt - +b.startAt));
          return list.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing here" />
          ) : (
            <ul className="space-y-2">
              {list.map((b) => (
                <li key={b.id} className="grid grid-cols-[88px_1fr] items-start gap-3">
                  <span className="text-muted-foreground pt-2 text-xs">{formatInTz(b.startAt, 'EEE d MMM', TZ)}</span>
                  <BookingCard b={b} onOpen={() => setOpenId(b.id)} />
                </li>
              ))}
            </ul>
          );
        })()
      )}

      <BookingSheet booking={open} onClose={() => setOpenId(null)} onChanged={reload} />
      {data && (
        <CreateBookingSheet
          open={creating}
          onOpenChange={setCreating}
          cars={data.cars}
          onCreated={(id) => {
            void reload().then(() => setOpenId(id));
          }}
        />
      )}
    </>
  );
}
