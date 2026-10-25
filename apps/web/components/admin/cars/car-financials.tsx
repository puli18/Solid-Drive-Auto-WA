/**
 * Financials tab (ADMIN ONLY – the car page never mounts this for staff, so carFinancials is never
 * requested). Purchase details + live profit summary (all ex GST) via the shared `profitSummary`.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { carFinancialsInputSchema, profitSummary, PURCHASE_SOURCE_LABELS, splitGstInclusive, zDateKey } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { actionErrorMessage, type CarRecord, getAdminRepo } from '@/lib/data';
import { centsToInput, dateKey, inputToCents, money, today } from '../format';
import { MoneyField, optionsFrom, SelectField, TextareaField, TextField } from '../fields';
import { useRepo } from '../use-data';
import { ErrorState, ListSkeleton, Panel, Stat } from '../ui';

const dollars = z.string().trim().refine((v) => v === '' || (Number.isFinite(inputToCents(v)) && inputToCents(v) >= 0), 'Enter an amount in dollars');
const schema = z.object({
  purchaseDate: zDateKey,
  purchasePrice: dollars.refine((v) => v !== '', 'Enter the purchase price'),
  purchaseGst: dollars,
  source: carFinancialsInputSchema.shape.source,
  sellerName: z.string().trim().max(120),
  notes: z.string().trim().max(5000),
});
type Input = z.input<typeof schema>;

export function CarFinancials({ car }: { car: CarRecord }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useRepo(
    async (r) => {
      const [fin, expenses, sales, business] = await Promise.all([r.getCarFinancials(car.id), r.listExpenses(car.id), r.listSales(), r.getSettings('business')]);
      return { fin, expenses, sale: sales.find((s) => s.carId === car.id) ?? null, gstRate: business.gstRate };
    },
    [car.id],
  );
  const form = useForm<Input, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), mode: 'onTouched' });

  useEffect(() => {
    if (!data) return;
    form.reset({
      purchaseDate: data.fin ? dateKey(data.fin.purchaseDate) : today(),
      purchasePrice: data.fin ? centsToInput(data.fin.purchasePriceCents) : '',
      purchaseGst: data.fin ? centsToInput(data.fin.purchaseGstCents) : '',
      source: data.fin?.source ?? ('' as never),
      sellerName: data.fin?.sellerName ?? '',
      notes: data.fin?.notes ?? '',
    });
  }, [data, form]);

  const purchase = useWatch({ control: form.control, name: 'purchasePrice' });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <ListSkeleton rows={4} />;

  const purchaseCents = Number.isFinite(inputToCents(purchase ?? '')) ? inputToCents(purchase ?? '') : 0;
  const expensesEx = data.expenses.reduce((s, e) => s + e.amountExGstCents, 0);
  const listEx = splitGstInclusive(car.priceCents, data.gstRate).amountExGstCents;
  const saleEx = data.sale?.salePriceCents ?? null;
  const actual = profitSummary({ purchasePriceExGstCents: purchaseCents, expensesExGstCents: expensesEx, salePriceExGstCents: saleEx });
  const projected = profitSummary({ purchasePriceExGstCents: purchaseCents, expensesExGstCents: expensesEx, salePriceExGstCents: listEx });
  const shown = saleEx != null ? actual : projected;

  async function submit(v: z.output<typeof schema>) {
    try {
      await getAdminRepo().saveCarFinancials(
        car.id,
        {
          purchaseDate: v.purchaseDate,
          purchasePriceCents: inputToCents(v.purchasePrice),
          purchaseGstCents: inputToCents(v.purchaseGst),
          source: v.source,
          sellerName: v.sellerName,
          notes: v.notes,
        },
        user!.uid,
      );
      toast.success('Purchase details saved');
      void reload();
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Panel title="Purchase" description="Purchase price excludes GST; record any GST paid separately.">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="purchaseDate" label="Purchase date" type="date" required />
            <SelectField control={form.control} name="source" label="Source" required options={optionsFrom(PURCHASE_SOURCE_LABELS)} />
            <MoneyField control={form.control} name="purchasePrice" label="Purchase price (ex GST)" required />
            <MoneyField control={form.control} name="purchaseGst" label="GST paid on purchase" />
            <TextField control={form.control} name="sellerName" label="Bought from" className="sm:col-span-2" />
            <TextareaField control={form.control} name="notes" label="Notes" rows={3} className="sm:col-span-2" />
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Save purchase details
              </Button>
            </div>
          </form>
        </Form>
      </Panel>

      <Panel title="Profit" description={saleEx != null ? 'Based on the recorded sale' : 'Projected at the current list price'} className="h-fit lg:sticky lg:top-20">
        <dl className="divide-y">
          <Stat label="Purchase" value={money(purchaseCents)} />
          <Stat label={`Expenses (${data.expenses.length})`} value={money(expensesEx)} />
          <Stat label="Total cost" value={money(shown.totalCostCents)} className="font-semibold" />
          <Stat label={saleEx != null ? 'Sale price' : 'List price'} value={money(saleEx ?? listEx)} />
        </dl>
        <div className="mt-3 rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Gross profit{saleEx == null && ' (projected)'}</div>
          <div className={cn('page-title text-3xl font-bold tabular-nums', (shown.grossProfitCents ?? 0) < 0 && 'text-destructive')}>
            {money(shown.grossProfitCents)}
          </div>
          <div className="text-muted-foreground text-xs tabular-nums">Margin {shown.marginPct == null ? '–' : `${shown.marginPct.toFixed(1)}%`} · all ex GST</div>
        </div>
      </Panel>
    </div>
  );
}
