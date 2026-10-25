import { MoreHorizontal, Paperclip, Plus, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORY_LABELS } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type ExpenseRecord, getAdminRepo } from '@/lib/data';
import { useConfirm } from '../confirm';
import { dateAU, money } from '../format';
import { useRepo } from '../use-data';
import { EmptyState, ErrorState, ListSkeleton } from '../ui';
import { ExpenseSheet } from './expense-sheet';

function ReceiptLink({ path }: { path: string | null | undefined }) {
  if (!path) return null;
  return (
    <a href={`/admin/receipts/${path}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
      <Paperclip className="size-3" /> Receipt
    </a>
  );
}

export function CarExpenses({ carId, onChanged }: { carId: string; onChanged?: () => void }) {
  const { user, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [sheet, setSheet] = useState<{ open: boolean; expense: ExpenseRecord | null }>({ open: false, expense: null });
  const { data, error, loading, reload } = useRepo(
    async (r) => {
      const [expenses, vendors, business] = await Promise.all([r.listExpenses(carId), r.listVendors(), r.getSettings('business')]);
      return { expenses, vendors, gstRate: business.gstRate };
    },
    [carId],
  );

  // Chronological running total (inc GST), shown newest first.
  const rows = useMemo(() => {
    if (!data) return [];
    let run = 0;
    return [...data.expenses]
      .sort((a, b) => +a.date - +b.date)
      .map((e) => ({ ...e, running: (run += e.totalCents) }))
      .reverse();
  }, [data]);
  const totals = useMemo(
    () => rows.reduce((t, e) => ({ ex: t.ex + e.amountExGstCents, gst: t.gst + e.gstCents, total: t.total + e.totalCents }), { ex: 0, gst: 0, total: 0 }),
    [rows],
  );

  async function remove(e: ExpenseRecord) {
    if (!user || !(await confirm({ title: 'Delete this expense?', description: `${e.description} – ${money(e.totalCents)}. An admin can restore it later.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await getAdminRepo().softDeleteExpense(carId, e.id, user.uid);
      toast.success('Expense deleted');
      void reload();
      onChanged?.();
    } catch (err) {
      toast.error(actionErrorMessage(err));
    }
  }

  const menu = (e: ExpenseRecord) =>
    isAdmin && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Expense actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setSheet({ open: true, expense: e })}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => void remove(e)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <dl className="grid grid-cols-3 gap-6">
          <div>
            <dt className="text-muted-foreground text-xs">Ex GST</dt>
            <dd className="page-title text-xl font-bold tabular-nums">{money(totals.ex)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">GST</dt>
            <dd className="page-title text-xl font-bold tabular-nums">{money(totals.gst)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Total</dt>
            <dd className="page-title text-xl font-bold tabular-nums">{money(totals.total)}</dd>
          </div>
        </dl>
        <Button onClick={() => setSheet({ open: true, expense: null })}>
          <Plus /> Add expense
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" action={<Button variant="outline" onClick={() => setSheet({ open: true, expense: null })}><Plus /> Add the first one</Button>}>
          Log reconditioning, servicing, transport and fees here so the profit figures stay right.
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl border md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="bg-card flex gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{e.description}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{money(e.totalCents, { cents: true })}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                    <span>{dateAU(e.date)}</span>
                    <span>{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                    {e.vendorName && <span className="truncate">{e.vendorName}</span>}
                    <ReceiptLink path={e.receiptPath} />
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">Running total {money(e.running)}</div>
                </div>
                {menu(e)}
              </li>
            ))}
          </ul>
          <div className="bg-card hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Ex GST</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Running</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{dateAU(e.date)}</TableCell>
                    <TableCell className="max-w-72">
                      <div className="truncate font-medium">{e.description}</div>
                      <div className="text-muted-foreground flex gap-2 text-xs">
                        {EXPENSE_CATEGORY_LABELS[e.category]}
                        {e.invoiceNo && <span className="font-mono">{e.invoiceNo}</span>}
                        <ReceiptLink path={e.receiptPath} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">{e.vendorName || '–'}</TableCell>
                    <TableCell className="text-right">{money(e.amountExGstCents, { cents: true })}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{money(e.gstCents, { cents: true })}</TableCell>
                    <TableCell className="text-right font-medium">{money(e.totalCents, { cents: true })}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{money(e.running, { cents: true })}</TableCell>
                    <TableCell>{menu(e)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-medium">
                  <TableCell colSpan={3}>Total ({rows.length})</TableCell>
                  <TableCell className="text-right">{money(totals.ex, { cents: true })}</TableCell>
                  <TableCell className="text-right">{money(totals.gst, { cents: true })}</TableCell>
                  <TableCell className="text-right">{money(totals.total, { cents: true })}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}

      {data && (
        <ExpenseSheet
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
          carId={carId}
          expense={sheet.expense}
          vendors={data.vendors}
          gstRate={data.gstRate}
          onSaved={() => {
            void reload();
            onChanged?.();
          }}
          onVendorsChanged={() => void reload()}
        />
      )}
    </div>
  );
}
