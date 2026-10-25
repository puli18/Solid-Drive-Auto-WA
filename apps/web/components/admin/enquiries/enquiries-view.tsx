/** /admin/enquiries – inbox with type + status filters, assign, notes, convert to booking. */
import { ArrowLeft, CalendarPlus, Car, Inbox, Loader2, Mail, Phone, Send } from 'lucide-react';
import Link from '@/components/link';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ENQUIRY_STATUS_LABELS, ENQUIRY_STATUSES, type EnquiryStatus, type TRADE_IN_CONDITIONS } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type AdminRepository, type EnquiryRecord, getAdminRepo } from '@/lib/data';
import { cn } from '@/lib/utils';
import { CreateBookingSheet } from '../bookings/create-booking-sheet';
import { dateTimeAU, relativeDays } from '../format';
import { useRepo } from '../use-data';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, ToneBadge } from '../ui';

const STATUS_TONE: Record<EnquiryStatus, 'danger' | 'info' | 'warning' | 'success' | 'neutral'> = {
  new: 'danger',
  contacted: 'info',
  booked: 'warning',
  won: 'success',
  lost: 'neutral',
};
const CONDITION_LABEL: Record<(typeof TRADE_IN_CONDITIONS)[number], string> = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };

async function load(r: AdminRepository, uid: string) {
  const [enquiries, cars] = await Promise.all([r.listEnquiries(), r.listCars()]);
  const users = await r.listUsers().catch(async () => [await r.getUser(uid)].filter(Boolean) as Awaited<ReturnType<typeof r.listUsers>>);
  return { enquiries, cars, users };
}

function Filters<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="flex w-max gap-1.5" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
            value === o.value ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Detail({
  e,
  names,
  users,
  onBook,
  onChanged,
}: {
  e: EnquiryRecord;
  names: Map<string, string>;
  users: { id: string; name: string }[];
  onBook: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const repo = getAdminRepo();

  async function patch(p: Parameters<AdminRepository['updateEnquiry']>[1], msg: string) {
    try {
      await repo.updateEnquiry(e.id, p, user!.uid);
      toast.success(msg);
      onChanged();
    } catch (err) {
      toast.error(actionErrorMessage(err));
    }
  }
  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await repo.addEnquiryNote(e.id, note.trim(), user!.uid);
      if (e.status === 'new') await repo.updateEnquiry(e.id, { status: 'contacted' }, user!.uid);
      setNote('');
      onChanged();
    } catch (err) {
      toast.error(actionErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const t = e.tradeInVehicle;
  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={STATUS_TONE[e.status]}>{ENQUIRY_STATUS_LABELS[e.status]}</ToneBadge>
          <span className="text-muted-foreground text-xs">{e.type === 'trade-in' ? 'Trade-in valuation' : 'General enquiry'} · {dateTimeAU(e.createdAt)}</span>
        </div>
        <h2 className="font-sans text-lg font-semibold">{e.customer.name}</h2>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${e.customer.phone.replace(/\s/g, '')}`}><Phone /> {e.customer.phone}</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`mailto:${e.customer.email}`}><Mail /> Email</a>
          </Button>
        </div>
      </header>

      {e.carId && (
        <Link href={`/admin/cars/${e.carId}`} className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <Car className="text-muted-foreground size-4" /> {e.carTitle ?? 'View car'}
        </Link>
      )}
      {e.message && <p className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-line">{e.message}</p>}
      {t && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border p-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground text-xs">Vehicle</dt><dd>{t.year} {t.make} {t.model}</dd></div>
          <div><dt className="text-muted-foreground text-xs">Odometer</dt><dd className="tabular-nums">{t.km.toLocaleString('en-AU')} km</dd></div>
          <div><dt className="text-muted-foreground text-xs">Condition</dt><dd>{CONDITION_LABEL[t.condition]}</dd></div>
          {t.rego && <div><dt className="text-muted-foreground text-xs">Rego</dt><dd className="font-mono text-xs">{t.rego}</dd></div>}
          <div><dt className="text-muted-foreground text-xs">Photos</dt><dd>{t.images.length}</dd></div>
        </dl>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={e.status} onValueChange={(v) => void patch({ status: v as EnquiryStatus }, `Marked ${ENQUIRY_STATUS_LABELS[v as EnquiryStatus].toLowerCase()}`)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENQUIRY_STATUSES.map((s) => <SelectItem key={s} value={s}>{ENQUIRY_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Assigned to</Label>
          <Select value={e.assignedTo ?? 'none'} onValueChange={(v) => void patch({ assignedTo: v === 'none' ? null : v }, v === 'none' ? 'Unassigned' : `Assigned to ${names.get(v) ?? 'user'}`)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              {e.assignedTo && !users.some((u) => u.id === e.assignedTo) && <SelectItem value={e.assignedTo}>Another user</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {e.bookingId ? (
        <p className="text-muted-foreground text-sm">
          Converted to a booking. <Link href="/admin/bookings" className="text-foreground underline-offset-4 hover:underline">Open bookings</Link>
        </p>
      ) : (
        <Button variant="outline" className="w-full sm:w-auto" onClick={onBook}>
          <CalendarPlus /> Convert to booking
        </Button>
      )}

      <section className="space-y-3 border-t pt-4">
        <h3 className="font-sans text-sm font-semibold">Notes</h3>
        {e.notes.length === 0 && <p className="text-muted-foreground text-sm">No notes yet.</p>}
        <ol className="space-y-3">
          {e.notes.map((n, i) => (
            <li key={i} className="text-sm">
              <p className="whitespace-pre-line">{n.text}</p>
              <p className="text-muted-foreground text-xs">{names.get(n.by) ?? 'Team'} · {relativeDays(n.at)}</p>
            </li>
          ))}
        </ol>
        <div className="flex items-end gap-2">
          <Textarea rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add a note – e.g. called back, left voicemail" aria-label="New note" />
          <Button size="icon" aria-label="Add note" onClick={() => void addNote()} disabled={!note.trim() || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </section>
    </article>
  );
}

export function EnquiriesView() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get('id');
  const [type, setType] = useState<'all' | 'general' | 'trade-in'>('all');
  const [status, setStatus] = useState<'open' | 'all' | EnquiryStatus>('open');
  const [booking, setBooking] = useState(false);
  const { data, error, loading, reload } = useRepo((r) => load(r, user!.uid), []);

  const names = useMemo(() => new Map((data?.users ?? []).map((u) => [u.id, u.name])), [data]);
  const list = useMemo(
    () =>
      (data?.enquiries ?? []).filter(
        (e) => (type === 'all' || e.type === type) && (status === 'all' ? true : status === 'open' ? e.status === 'new' || e.status === 'contacted' : e.status === status),
      ),
    [data, type, status],
  );
  const current = data?.enquiries.find((e) => e.id === selected) ?? null;
  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  return (
    <>
      <PageHeader title="Enquiries" description="Website enquiries and trade-in requests" />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(280px,380px)_1fr]">
          <div className={cn('space-y-3', current && 'hidden md:block')}>
            <div className="-mx-4 space-y-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
              <Filters
                label="Status"
                value={status}
                onChange={setStatus}
                options={[{ value: 'open', label: 'Open' }, ...ENQUIRY_STATUSES.map((s) => ({ value: s, label: ENQUIRY_STATUS_LABELS[s] })), { value: 'all', label: 'All' }]}
              />
              <Filters label="Type" value={type} onChange={setType} options={[{ value: 'all', label: 'All types' }, { value: 'general', label: 'General' }, { value: 'trade-in', label: 'Trade-in' }]} />
            </div>
            {list.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing here">No enquiries match these filters.</EmptyState>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border">
                {list.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => select(e.id)}
                      aria-current={selected === e.id}
                      className={cn('bg-card hover:bg-accent/50 flex w-full items-start gap-3 px-3 py-3 text-left transition-colors', selected === e.id && 'bg-accent')}
                    >
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.status === 'new' ? 'bg-primary' : 'bg-transparent')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-sm', e.status === 'new' && 'font-semibold')}>{e.customer.name}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">{relativeDays(e.createdAt)}</span>
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {e.type === 'trade-in' ? 'Trade-in' : e.carTitle ?? 'General'}
                          {e.assignedTo && ` · ${names.get(e.assignedTo) ?? 'Assigned'}`}
                        </span>
                        <span className="text-muted-foreground line-clamp-1 text-xs">{e.message}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={cn('bg-card rounded-xl border p-4 sm:p-5', !current && 'hidden md:block')}>
            {current ? (
              <>
                <button type="button" onClick={() => select(null)} className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-xs md:hidden">
                  <ArrowLeft className="size-3.5" /> Inbox
                </button>
                <Detail e={current} names={names} users={data.users.map((u) => ({ id: u.id, name: u.name }))} onBook={() => setBooking(true)} onChanged={reload} />
              </>
            ) : (
              <EmptyState icon={Inbox} title="Select an enquiry">Pick one from the list to read it, assign it or book the customer in.</EmptyState>
            )}
          </div>
        </div>
      )}
      {data && current && (
        <CreateBookingSheet
          open={booking}
          onOpenChange={setBooking}
          cars={data.cars}
          prefill={{ carId: current.carId, customer: current.customer, notes: `From enquiry: ${current.message.slice(0, 200)}`, type: current.type === 'trade-in' ? 'inspection' : 'test-drive' }}
          onCreated={async (bookingId) => {
            await getAdminRepo().updateEnquiry(current.id, { status: 'booked', bookingId }, user!.uid);
            void reload();
          }}
        />
      )}
    </>
  );
}
