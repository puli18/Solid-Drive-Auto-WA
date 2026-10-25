/** /admin/deposits (admin) – deposits with status; conflicts highlighted and marked resolved here. */
import { AlertTriangle, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import Link from '@/components/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_STATUSES, type DepositStatus } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type DepositRecord, getAdminRepo } from '@/lib/data';
import { cn } from '@/lib/utils';
import { dateTimeAU, money } from '../format';
import { FormSheet } from '../form-sheet';
import { useRepo } from '../use-data';
import { AdminOnly, EmptyState, ErrorState, ListSkeleton, PageHeader, ToneBadge } from '../ui';

const TONE: Record<DepositStatus, 'success' | 'neutral' | 'warning' | 'danger'> = { paid: 'success', pending: 'warning', expired: 'neutral', conflict: 'danger' };

function Deposits() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | DepositStatus>('all');
  const [resolving, setResolving] = useState<DepositRecord | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useRepo((r) => r.listDeposits(), []);

  const open = useMemo(() => (data ?? []).filter((d) => d.status === 'conflict' && !d.conflictResolvedAt), [data]);
  const rows = useMemo(() => (data ?? []).filter((d) => filter === 'all' || d.status === filter), [data, filter]);

  async function resolve() {
    if (!resolving) return;
    setBusy(true);
    try {
      await getAdminRepo().resolveDepositConflict(resolving.id, note.trim(), user!.uid);
      toast.success('Conflict marked resolved');
      setResolving(null);
      void reload();
    } catch (e) {
      toast.error(actionErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Deposits" description="Non-refundable holding deposits taken through Stripe" />
      {open.length > 0 && (
        <div role="alert" className="border-destructive/40 bg-destructive/5 mb-4 flex items-start gap-3 rounded-xl border p-4 text-sm">
          <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">
              {open.length} deposit conflict{open.length === 1 ? '' : 's'} need{open.length === 1 ? 's' : ''} attention
            </p>
            <p className="text-muted-foreground">Two customers paid for the same car. Sort it out with the customer in the Stripe dashboard, then mark it resolved here.</p>
          </div>
        </div>
      )}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-1.5">
          {(['all', ...DEPOSIT_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn('h-8 rounded-full border px-3 text-xs font-medium', filter === s ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground hover:bg-accent')}
            >
              {s === 'all' ? 'All' : DEPOSIT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={Wallet} title="No deposits">Deposits appear here when customers reserve a car online.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => {
            const conflict = d.status === 'conflict' && !d.conflictResolvedAt;
            return (
              <li key={d.id} className={cn('bg-card rounded-xl border p-4', conflict && 'border-destructive/50 bg-destructive/5')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="page-title text-lg font-bold tabular-nums">{money(d.amountCents)}</span>
                      <ToneBadge tone={TONE[d.status]}>{DEPOSIT_STATUS_LABELS[d.status]}</ToneBadge>
                      {d.status === 'conflict' && d.conflictResolvedAt && (
                        <span className="text-success inline-flex items-center gap-1 text-xs"><CheckCircle2 className="size-3.5" /> Resolved</span>
                      )}
                    </div>
                    <p className="text-sm">
                      {d.customer.name} · <a className="text-muted-foreground underline-offset-4 hover:underline" href={`tel:${d.customer.phone}`}>{d.customer.phone}</a>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <Link href={`/admin/cars/${d.carId}`} className="underline-offset-4 hover:underline">{d.carTitle ?? d.carId} {d.stockNo && `(${d.stockNo})`}</Link>
                      {' · '}
                      {d.paidAt ? `Paid ${dateTimeAU(d.paidAt)}` : `Started ${dateTimeAU(d.createdAt)}`}
                    </p>
                    {d.conflictNote && <p className="text-muted-foreground mt-1 text-xs">Note: {d.conflictNote}</p>}
                    <p className="text-muted-foreground/80 mt-1 font-mono text-[11px] break-all">{d.stripePaymentIntentId ?? d.stripeSessionId}</p>
                  </div>
                  {conflict && (
                    <Button variant="outline" onClick={() => { setResolving(d); setNote(''); }}>
                      Mark resolved
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FormSheet
        open={!!resolving}
        onOpenChange={(o) => !o && setResolving(null)}
        title="Mark conflict resolved"
        description="There’s no refund button here – refunds (if any) are done in Stripe."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={() => void resolve()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Mark resolved
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="conflict-note">What happened?</Label>
          <Textarea id="conflict-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called customer, refunded in Stripe on 26/10" />
        </div>
      </FormSheet>
    </>
  );
}

export function DepositsView() {
  return (
    <AdminOnly>
      <Deposits />
    </AdminOnly>
  );
}
