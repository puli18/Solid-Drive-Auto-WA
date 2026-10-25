/**
 * Sale tab. Staff: view + create. Admin: also edit. Saving a new sale marks the car Sold.
 * Deposit link auto-fills for admins (deposits are admin-read); trade-in can create a linked Draft car.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Loader2, Paperclip, Pencil, X } from 'lucide-react';
import Link from '@/components/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  BODY_TYPE_LABELS,
  bodyTypeSchema,
  canTransitionCar,
  carTitle,
  gstFromTotal,
  PAYMENT_METHOD_LABELS,
  paymentMethodSchema,
  saleInputSchema,
  type SaleFormValues,
  zDateKey,
  zEmail,
  zPhone,
} from '@sda/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type AdminRepository, type CarRecord, getAdminRepo, type SaleRecord } from '@/lib/data';
import { centsToInput, dateAU, dateKey, inputToCents, money, today, TZ } from '../format';
import { FormSection, MoneyField, optionsFrom, SelectField, SwitchField, TextareaField, TextField } from '../fields';
import { safeFileName, sessionFileUrl, uploadPrivateFile } from '../upload';
import { useRepo } from '../use-data';
import { ErrorState, ListSkeleton, MoneyInput, Panel, Stat } from '../ui';
import { zonedToUtc } from '@sda/shared';

const dollars = (msg: string) => z.string().trim().refine((v) => v !== '' && Number.isFinite(inputToCents(v)) && inputToCents(v) >= 0, msg);
const optDollars = z.string().trim().refine((v) => v === '' || (Number.isFinite(inputToCents(v)) && inputToCents(v) >= 0), 'Enter an amount');

const schema = z
  .object({
    saleDate: zDateKey,
    price: dollars('Enter the sale price'),
    buyerName: z.string().trim().min(1, 'Required').max(120),
    buyerPhone: zPhone,
    buyerEmail: zEmail.or(z.literal('')),
    buyerAddress: z.string().trim().max(300),
    buyerLicence: z.string().trim().max(30),
    paymentMethod: paymentMethodSchema,
    financeCompany: z.string().trim().max(120),
    depositId: z.string(),
    hasTradeIn: z.boolean(),
    tradeValue: optDollars,
    tradeDescription: z.string().trim().max(200),
    createTradeCar: z.boolean(),
    tradeMake: z.string().trim().max(40),
    tradeModel: z.string().trim().max(60),
    tradeYear: z.string().trim(),
    tradeKm: z.string().trim(),
    tradeRego: z.string().trim().max(10),
    tradeBody: bodyTypeSchema.or(z.literal('')),
    warranty: z.string().trim().max(300),
    deliveryDate: zDateKey.or(z.literal('')),
    salespersonUid: z.string().min(1, 'Choose the salesperson'),
    notes: z.string().trim().max(5000),
  })
  .superRefine((v, ctx) => {
    if (v.hasTradeIn && v.tradeValue === '') ctx.addIssue({ code: 'custom', path: ['tradeValue'], message: 'Enter the trade-in value' });
    if (v.hasTradeIn && v.createTradeCar) {
      if (!v.tradeMake) ctx.addIssue({ code: 'custom', path: ['tradeMake'], message: 'Required' });
      if (!v.tradeModel) ctx.addIssue({ code: 'custom', path: ['tradeModel'], message: 'Required' });
      if (!/^\d{4}$/.test(v.tradeYear)) ctx.addIssue({ code: 'custom', path: ['tradeYear'], message: 'Enter the year' });
      if (!/^\d+$/.test(v.tradeKm.replace(/,/g, ''))) ctx.addIssue({ code: 'custom', path: ['tradeKm'], message: 'Enter the km' });
      if (!v.tradeBody) ctx.addIssue({ code: 'custom', path: ['tradeBody'], message: 'Choose the body' });
    }
  });
type Input = z.input<typeof schema>;

async function load(r: AdminRepository, carId: string, isAdmin: boolean, uid: string) {
  const [sales, business, cars, app] = await Promise.all([r.listSales(), r.getSettings('business'), r.listCars({ includeDeleted: true }), r.getSettings('app')]);
  // Staff may only read their own user doc – fall back to "me" when the full list is denied.
  const users = await r.listUsers().catch(async () => [await r.getUser(uid)].filter(Boolean) as Awaited<ReturnType<typeof r.listUsers>>);
  const deposits = isAdmin ? (await r.listDeposits()).filter((d) => d.carId === carId && (d.status === 'paid' || d.status === 'conflict')) : [];
  return { sale: sales.find((s) => s.carId === carId) ?? null, gstRate: business.gstRate, cars, nextStock: app.nextStockNo ?? 1001, users, deposits };
}

export function nextStockNo(cars: CarRecord[], fromSettings: number): string {
  const max = cars.reduce((m, c) => {
    const n = /^SDA(\d+)$/.exec(c.stockNo)?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return `SDA${Math.max(max + 1, fromSettings)}`;
}

function SaleSummary({ sale, car, users, onEdit }: { sale: SaleRecord; car: CarRecord; users: { id: string; name: string }[]; onEdit?: () => void }) {
  const inc = sale.salePriceCents + sale.saleGstCents;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Sale" action={onEdit && <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>}>
        <dl className="divide-y">
          <Stat label="Sale date" value={dateAU(sale.saleDate)} />
          <Stat label="Sale price (inc GST)" value={money(inc)} />
          <Stat label="Ex GST / GST" value={`${money(sale.salePriceCents)} / ${money(sale.saleGstCents)}`} />
          <Stat label="Payment" value={`${PAYMENT_METHOD_LABELS[sale.paymentMethod]}${sale.financeCompany ? ` · ${sale.financeCompany}` : ''}`} />
          {sale.depositId && <Stat label="Deposit" value={<span className="font-mono text-xs">{sale.depositId}</span>} />}
          {sale.tradeIn && (
            <Stat
              label="Trade-in"
              value={
                <>
                  {money(sale.tradeIn.valueCents)}
                  {sale.tradeIn.carId && (
                    <Link href={`/admin/cars/${sale.tradeIn.carId}`} className="text-primary ml-2 text-xs underline-offset-4 hover:underline">
                      Open car
                    </Link>
                  )}
                </>
              }
            />
          )}
          <Stat label="Warranty" value={sale.warranty || '–'} />
          <Stat label="Delivery" value={dateAU(sale.deliveryDate)} />
          <Stat label="Salesperson" value={users.find((u) => u.id === sale.salespersonUid)?.name ?? sale.salespersonUid} />
        </dl>
      </Panel>
      <Panel title="Buyer">
        <dl className="divide-y">
          <Stat label="Name" value={sale.buyer.name} />
          <Stat label="Phone" value={<a href={`tel:${sale.buyer.phone}`} className="underline-offset-4 hover:underline">{sale.buyer.phone}</a>} />
          <Stat label="Email" value={sale.buyer.email || '–'} />
          <Stat label="Address" value={sale.buyer.address || '–'} />
          <Stat label="Licence no" value={sale.buyer.licenceNo || '–'} />
        </dl>
        {sale.documents.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs font-medium">Documents</p>
            <ul className="space-y-1">
              {sale.documents.map((d) => (
                <li key={d}>
                  <a href={sessionFileUrl(d) ?? `/admin/receipts/${d}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm">
                    <FileText className="size-3.5" /> {d.split('/').pop()}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sale.notes && <p className="text-muted-foreground mt-3 border-t pt-3 text-sm whitespace-pre-line">{sale.notes}</p>}
      </Panel>
      <p className="text-muted-foreground text-xs lg:col-span-2">Car: {carTitle(car)} ({car.stockNo})</p>
    </div>
  );
}

export function CarSale({ car, onChanged }: { car: CarRecord; onChanged: () => void }) {
  const { user, isAdmin, role } = useAuth();
  const { data, error, loading, reload } = useRepo((r) => load(r, car.id, isAdmin, user!.uid), [car.id, isAdmin]);
  const [editing, setEditing] = useState(false);
  const [docs, setDocs] = useState<File[]>([]);
  const [keptDocs, setKeptDocs] = useState<string[]>([]);
  const [gstOverride, setGstOverride] = useState<string | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const form = useForm<Input, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const sale = data?.sale ?? null;
  const users = useMemo(() => (data?.users ?? []).filter((u) => u.active !== false).map((u) => ({ id: u.id, name: u.name })), [data]);

  useEffect(() => {
    if (!data) return;
    const s = data.sale;
    form.reset({
      saleDate: s ? dateKey(s.saleDate) : today(),
      price: s ? centsToInput(s.salePriceCents + s.saleGstCents) : centsToInput(car.priceCents),
      buyerName: s?.buyer.name ?? data.deposits[0]?.customer.name ?? '',
      buyerPhone: s?.buyer.phone ?? data.deposits[0]?.customer.phone ?? '',
      buyerEmail: s?.buyer.email ?? data.deposits[0]?.customer.email ?? '',
      buyerAddress: s?.buyer.address ?? '',
      buyerLicence: s?.buyer.licenceNo ?? '',
      paymentMethod: s?.paymentMethod ?? ('' as never),
      financeCompany: s?.financeCompany ?? '',
      depositId: s?.depositId ?? data.deposits.find((d) => d.status === 'paid')?.id ?? '',
      hasTradeIn: !!s?.tradeIn,
      tradeValue: s?.tradeIn ? centsToInput(s.tradeIn.valueCents) : '',
      tradeDescription: s?.tradeIn?.description ?? '',
      createTradeCar: false,
      tradeMake: '',
      tradeModel: '',
      tradeYear: '',
      tradeKm: '',
      tradeRego: '',
      tradeBody: '',
      warranty: s?.warranty ?? '',
      deliveryDate: s?.deliveryDate ? dateKey(s.deliveryDate) : '',
      salespersonUid: s?.salespersonUid ?? user?.uid ?? '',
      notes: s?.notes ?? '',
    });
    setKeptDocs(s?.documents ?? []);
    setDocs([]);
    const autoGst = s ? gstFromTotal(s.salePriceCents + s.saleGstCents, data.gstRate) : 0;
    setGstOverride(s && s.saleGstCents !== autoGst ? centsToInput(s.saleGstCents) : null);
  }, [data, car.priceCents, form, user?.uid]);

  const [priceStr, payment, hasTradeIn, createTradeCar] = useWatch({ control: form.control, name: ['price', 'paymentMethod', 'hasTradeIn', 'createTradeCar'] });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <ListSkeleton rows={4} />;

  if (sale && !editing) return <SaleSummary sale={sale} car={car} users={users} onEdit={isAdmin ? () => setEditing(true) : undefined} />;

  const blocked = !sale && car.status !== 'sold' ? canTransitionCar(car.status, 'sold', { role: role ?? 'staff', car }) : { ok: true as const };
  const totalCents = Number.isFinite(inputToCents(priceStr ?? '')) ? inputToCents(priceStr ?? '') : 0;
  const gstCents = gstOverride != null ? inputToCents(gstOverride) : gstFromTotal(totalCents, data.gstRate);
  const gstBad = !Number.isFinite(gstCents) || gstCents < 0 || gstCents > totalCents;

  async function submit(v: z.output<typeof schema>) {
    if (!user || !data) return;
    if (gstBad) return toast.error('GST must be between $0 and the sale price');
    const repo = getAdminRepo();
    try {
      let tradeCarId: string | null = sale?.tradeIn?.carId ?? null;
      if (v.hasTradeIn && v.createTradeCar && !tradeCarId) {
        const stockNo = nextStockNo(data.cars, data.nextStock);
        tradeCarId = await repo.createCar(
          {
            stockNo,
            make: v.tradeMake,
            model: v.tradeModel,
            year: Number(v.tradeYear),
            km: Number(v.tradeKm.replace(/,/g, '')),
            rego: v.tradeRego,
            bodyType: v.tradeBody as z.infer<typeof bodyTypeSchema>,
            transmission: 'automatic',
            fuel: 'petrol',
            priceCents: 0,
            status: 'draft',
            published: false,
            description: `Trade-in on the sale of ${carTitle(car)} (${car.stockNo}).`,
          },
          user.uid,
        );
        if (isAdmin)
          await repo.saveCarFinancials(
            tradeCarId,
            { purchaseDate: v.saleDate, purchasePriceCents: inputToCents(v.tradeValue), purchaseGstCents: 0, source: 'trade-in', sellerName: v.buyerName, notes: `Traded in against ${car.stockNo}` },
            user.uid,
          );
      }
      const uploaded: string[] = [];
      for (const f of docs) {
        try {
          uploaded.push(await uploadPrivateFile(`sales/${car.id}/${Date.now()}-${safeFileName(f.name)}`, f));
        } catch (e) {
          toast.warning(`${f.name} wasn't uploaded: ${actionErrorMessage(e)}`);
        }
      }
      const input: SaleFormValues = {
        carId: car.id,
        stockNo: car.stockNo,
        saleDate: v.saleDate,
        salePriceCents: totalCents - gstCents,
        saleGstCents: gstCents,
        buyer: { name: v.buyerName, phone: v.buyerPhone, email: v.buyerEmail, address: v.buyerAddress, licenceNo: v.buyerLicence },
        depositId: v.depositId.trim() || null,
        tradeIn: v.hasTradeIn ? { carId: tradeCarId, valueCents: inputToCents(v.tradeValue), description: v.tradeDescription } : null,
        paymentMethod: v.paymentMethod,
        financeCompany: v.paymentMethod === 'finance' ? v.financeCompany : '',
        warranty: v.warranty,
        deliveryDate: v.deliveryDate || null,
        salespersonUid: v.salespersonUid,
        documents: [...keptDocs, ...uploaded],
        notes: v.notes,
      };
      const parsed = saleInputSchema.safeParse(input);
      if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Check the sale details');
      if (sale) {
        await repo.updateSale(sale.id, input, user.uid);
        toast.success('Sale updated');
        setEditing(false);
      } else {
        await repo.createSale(input, user.uid);
        if (car.status !== 'sold') await repo.updateCar(car.id, { status: 'sold', soldAt: zonedToUtc(v.saleDate, '12:00', TZ), reservedAt: car.reservedAt ?? null }, user.uid);
        toast.success(`${car.stockNo} marked as sold`);
      }
      onChanged();
      void reload();
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }

  const c = form.control;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit, () => toast.error('Check the highlighted fields'))} className="space-y-6" noValidate>
        {!blocked.ok && (
          <Alert>
            <AlertDescription>
              This car can&apos;t be sold from <strong>{car.status}</strong>: {blocked.reason}. List it as available first.
            </AlertDescription>
          </Alert>
        )}
        {!sale && blocked.ok && (
          <p className="text-muted-foreground text-sm">Saving this form records the sale and marks {car.stockNo} as <strong className="text-foreground">Sold</strong>.</p>
        )}

        <FormSection title="Sale" description="Price is drive-away, including GST.">
          <TextField control={c} name="saleDate" label="Sale date" type="date" required />
          <MoneyField control={c} name="price" label="Sale price (inc GST)" required />
          <div className="bg-muted/50 rounded-lg p-3 text-sm sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="tabular-nums">
                Ex GST <strong>{money(gstBad ? NaN : totalCents - gstCents, { cents: true })}</strong> · GST{' '}
                <strong>{money(gstBad ? NaN : gstCents, { cents: true })}</strong>
                {gstOverride == null && <span className="text-muted-foreground"> ({data.gstRate}%)</span>}
              </span>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={gstOverride != null} onCheckedChange={(v) => setGstOverride(v ? centsToInput(gstFromTotal(totalCents, data.gstRate)) : null)} />
                Override GST
              </label>
            </div>
            {gstOverride != null && <MoneyInput className="mt-2 max-w-48" value={gstOverride} onChange={(e) => setGstOverride(e.target.value)} aria-label="GST amount" aria-invalid={gstBad} />}
          </div>
          <SelectField control={c} name="paymentMethod" label="Payment method" required options={optionsFrom(PAYMENT_METHOD_LABELS)} />
          {payment === 'finance' ? <TextField control={c} name="financeCompany" label="Finance company" /> : <div className="hidden sm:block" />}
          {isAdmin && (
            <SelectField
              control={c}
              name="depositId"
              label="Linked deposit"
              description={data.deposits.length ? 'Auto-filled from the paid deposit on this car' : 'No paid deposit on this car'}
              options={[{ value: ' ', label: 'None' }, ...data.deposits.map((d) => ({ value: d.id, label: `${money(d.amountCents)} · ${d.customer.name}` }))]}
            />
          )}
          <SelectField control={c} name="salespersonUid" label="Salesperson" required options={users.map((u) => ({ value: u.id, label: u.name }))} />
        </FormSection>

        <FormSection title="Buyer">
          <TextField control={c} name="buyerName" label="Full name" required autoComplete="off" />
          <TextField control={c} name="buyerPhone" label="Phone" type="tel" required autoComplete="off" />
          <TextField control={c} name="buyerEmail" label="Email" type="email" autoComplete="off" />
          <TextField control={c} name="buyerLicence" label="Licence no" autoComplete="off" />
          <TextField control={c} name="buyerAddress" label="Address" className="sm:col-span-2" autoComplete="off" />
        </FormSection>

        <FormSection title="Trade-in" description="Optionally create a Draft car for the trade-in, linked back to this sale.">
          <SwitchField control={c} name="hasTradeIn" label="Customer is trading in a vehicle" className="sm:col-span-2" />
          {hasTradeIn && (
            <>
              <MoneyField control={c} name="tradeValue" label="Trade-in value" required />
              <TextField control={c} name="tradeDescription" label="Description" placeholder="2016 Toyota Corolla Ascent" />
              {sale?.tradeIn?.carId ? (
                <p className="text-muted-foreground text-sm sm:col-span-2">
                  Linked car: <Link className="text-primary underline-offset-4 hover:underline" href={`/admin/cars/${sale.tradeIn.carId}`}>open trade-in car</Link>
                </p>
              ) : (
                <SwitchField control={c} name="createTradeCar" label="Create a Draft car for it" className="sm:col-span-2" />
              )}
              {createTradeCar && !sale?.tradeIn?.carId && (
                <>
                  <TextField control={c} name="tradeMake" label="Make" required />
                  <TextField control={c} name="tradeModel" label="Model" required />
                  <TextField control={c} name="tradeYear" label="Year" inputMode="numeric" required />
                  <TextField control={c} name="tradeKm" label="Odometer (km)" inputMode="numeric" required />
                  <TextField control={c} name="tradeRego" label="Rego" autoCapitalize="characters" />
                  <SelectField control={c} name="tradeBody" label="Body" required options={optionsFrom(BODY_TYPE_LABELS)} />
                </>
              )}
            </>
          )}
        </FormSection>

        <FormSection title="Handover">
          <TextField control={c} name="warranty" label="Warranty" placeholder="3 months / 5,000 km statutory" />
          <TextField control={c} name="deliveryDate" label="Delivery date" type="date" />
          <TextareaField control={c} name="notes" label="Notes" rows={3} className="sm:col-span-2" />
          <div className="space-y-2 sm:col-span-2">
            <Label>Documents</Label>
            <ul className="space-y-1.5">
              {keptDocs.map((d) => (
                <li key={d} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <FileText className="text-muted-foreground size-4" />
                  <span className="min-w-0 flex-1 truncate">{d.split('/').pop()}</span>
                  {isAdmin && (
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove document" onClick={() => setKeptDocs((k) => k.filter((x) => x !== d))}>
                      <X />
                    </Button>
                  )}
                </li>
              ))}
              {docs.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm">
                  <Paperclip className="text-muted-foreground size-4" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove file" onClick={() => setDocs((d) => d.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={() => docRef.current?.click()}>
              <Paperclip /> Add documents
            </Button>
            <input
              ref={docRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])].filter((f) => f.size <= 10 * 1024 * 1024);
                if (files.length < (e.target.files?.length ?? 0)) toast.warning('Files over 10 MB were skipped');
                setDocs((d) => [...d, ...files]);
                e.target.value = '';
              }}
            />
          </div>
        </FormSection>

        <div className="flex justify-end gap-2 border-t pt-4">
          {sale && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting || !blocked.ok}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            {sale ? 'Save sale' : 'Record sale & mark sold'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
