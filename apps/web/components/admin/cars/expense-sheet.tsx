/**
 * Add / edit expense sheet. Total is entered inc GST; GST auto-calculates at the business GST rate
 * (shared `gstFromTotal`) and can be overridden. Receipt: camera or file (image/PDF, max 10 MB).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  EXPENSE_CATEGORY_LABELS,
  expenseCategorySchema,
  expenseInputSchema,
  type ExpenseFormValues,
  gstFromTotal,
  RECEIPT_MAX_BYTES,
  zDateKey,
} from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormItem, FormLabel } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type ExpenseRecord, getAdminRepo, type VendorRecord } from '@/lib/data';
import { centsToInput, dateKey, inputToCents, money, today } from '../format';
import { MoneyField, optionsFrom, SelectField, TextareaField, TextField } from '../fields';
import { FormSheet } from '../form-sheet';
import { safeFileName, uploadPrivateFile } from '../upload';
import { MoneyInput } from '../ui';
import { VendorPicker } from '../vendor-picker';

const money$ = z.string().trim().refine((v) => v !== '' && Number.isFinite(inputToCents(v)) && inputToCents(v) > 0, 'Enter the amount');
const schema = z.object({
  date: zDateKey,
  category: expenseCategorySchema,
  description: z.string().trim().min(1, 'Describe the work or item').max(500),
  invoiceNo: z.string().trim().max(60),
  total: money$,
});
type Input = z.input<typeof schema>;

export function ExpenseSheet({
  open,
  onOpenChange,
  carId,
  expense,
  vendors,
  gstRate,
  onSaved,
  onVendorsChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  carId: string;
  expense: ExpenseRecord | null;
  vendors: VendorRecord[];
  gstRate: number;
  onSaved: () => void;
  onVendorsChanged: () => void;
}) {
  const { user } = useAuth();
  const form = useForm<Input, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const [vendor, setVendor] = useState<{ id: string | null; name: string }>({ id: null, name: '' });
  const [overrideGst, setOverrideGst] = useState(false);
  const [gstInput, setGstInput] = useState('');
  const [noGst, setNoGst] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    form.reset({
      date: expense ? dateKey(expense.date) : today(),
      category: expense?.category ?? ('' as never),
      description: expense?.description ?? '',
      invoiceNo: expense?.invoiceNo ?? '',
      total: expense ? centsToInput(expense.totalCents) : '',
    });
    setVendor({ id: expense?.vendorId ?? null, name: expense?.vendorName ?? '' });
    const auto = expense ? gstFromTotal(expense.totalCents, gstRate) : 0;
    setNoGst(!!expense && expense.gstCents === 0 && expense.totalCents > 0);
    setOverrideGst(!!expense && expense.gstCents !== auto && expense.gstCents !== 0);
    setGstInput(expense ? centsToInput(expense.gstCents) : '');
    setReceipt(null);
    setExistingReceipt(expense?.receiptPath ?? null);
  }, [open, expense, gstRate, form]);

  const totalStr = useWatch({ control: form.control, name: 'total' });
  const totalCents = Number.isFinite(inputToCents(totalStr ?? '')) ? inputToCents(totalStr ?? '') : 0;
  const autoGst = noGst ? 0 : gstFromTotal(totalCents, gstRate);
  const gstCents = noGst ? 0 : overrideGst ? inputToCents(gstInput) : autoGst;
  const gstInvalid = !Number.isFinite(gstCents) || gstCents < 0 || gstCents > totalCents;

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.size > RECEIPT_MAX_BYTES) return toast.error('Receipt is larger than 10 MB');
    if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) return toast.error('Receipt must be an image or a PDF');
    setReceipt(f);
  }

  async function submit(v: z.output<typeof schema>) {
    if (!user) return;
    if (gstInvalid) return toast.error('GST must be between $0 and the total');
    try {
      let receiptPath = existingReceipt;
      if (receipt) {
        try {
          receiptPath = await uploadPrivateFile(`receipts/${carId}/${Date.now()}-${safeFileName(receipt.name)}`, receipt);
        } catch (e) {
          toast.warning(`Saved without the receipt: ${actionErrorMessage(e)}`);
        }
      }
      const total = inputToCents(v.total);
      const input: ExpenseFormValues = {
        date: v.date,
        category: v.category,
        description: v.description,
        vendorId: vendor.id,
        vendorName: vendor.name,
        invoiceNo: v.invoiceNo,
        totalCents: total,
        gstCents,
        amountExGstCents: total - gstCents,
        receiptPath,
      };
      const parsed = expenseInputSchema.safeParse(input);
      if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Check the form');
      const repo = getAdminRepo();
      if (expense) await repo.updateExpense(carId, expense.id, input, user.uid);
      else await repo.createExpense(carId, input, user.uid);
      toast.success(expense ? 'Expense updated' : `Expense of ${money(total)} added`);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }

  const submitting = form.formState.isSubmitting;
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? 'Edit expense' : 'Add expense'}
      description="Amounts include GST unless the vendor doesn't charge it."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {expense ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id="expense-form" onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField control={form.control} name="date" label="Date" type="date" required />
          <SelectField control={form.control} name="category" label="Category" required options={optionsFrom(EXPENSE_CATEGORY_LABELS)} />
          <TextareaField control={form.control} name="description" label="Description" required rows={2} className="sm:col-span-2" placeholder="e.g. Replace front brake pads and rotors" />
          <FormItem className="sm:col-span-2">
            <Label htmlFor="vendor-picker">Vendor</Label>
            <VendorPicker id="vendor-picker" vendors={vendors} value={vendor} onChange={setVendor} onCreated={onVendorsChanged} />
          </FormItem>
          <TextField control={form.control} name="invoiceNo" label="Invoice no" autoComplete="off" />
          <MoneyField control={form.control} name="total" label="Total (inc GST)" required placeholder="0.00" />

          <div className="bg-muted/50 space-y-3 rounded-lg p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={noGst} onCheckedChange={(c) => { setNoGst(!!c); if (c) setOverrideGst(false); }} />
                No GST charged
              </label>
              {!noGst && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={overrideGst}
                    onCheckedChange={(c) => {
                      setOverrideGst(!!c);
                      setGstInput(centsToInput(autoGst));
                    }}
                  />
                  Override GST
                </label>
              )}
            </div>
            {overrideGst && !noGst && (
              <FormItem>
                <FormLabel htmlFor="gst-override">GST amount</FormLabel>
                <MoneyInput id="gst-override" value={gstInput} onChange={(e) => setGstInput(e.target.value)} aria-invalid={gstInvalid} />
              </FormItem>
            )}
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Ex GST</dt>
                <dd className="text-sm font-medium tabular-nums">{money(gstInvalid ? NaN : totalCents - gstCents, { cents: true })}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">GST {noGst ? '' : overrideGst ? '(manual)' : `(${gstRate}%)`}</dt>
                <dd className="text-sm font-medium tabular-nums">{money(gstInvalid ? NaN : gstCents, { cents: true })}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-sm font-medium tabular-nums">{money(totalCents, { cents: true })}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Receipt</Label>
            {receipt || existingReceipt ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{receipt?.name ?? existingReceipt?.split('/').pop()}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove receipt" onClick={() => { setReceipt(null); setExistingReceipt(null); }}>
                  <X />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => camRef.current?.click()}>
                  <Camera /> Photograph
                </Button>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Paperclip /> Attach file
                </Button>
              </div>
            )}
            <p className="text-muted-foreground text-xs">Image or PDF, up to 10 MB.</p>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </form>
      </Form>
    </FormSheet>
  );
}
