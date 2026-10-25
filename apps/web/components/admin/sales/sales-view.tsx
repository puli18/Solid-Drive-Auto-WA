/** /admin/sales – all sales, filter by date range, open a sale (car's Sale tab). No profit shown here. */
import { Receipt } from 'lucide-react';
import Link from '@/components/link';
import { useMemo, useState } from 'react';
import { addDaysToDateKey, carTitle, PAYMENT_METHOD_LABELS } from '@sda/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { dateAU, dateKey, money, today } from '../format';
import { useRepo } from '../use-data';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../ui';

type Preset = '30' | '90' | 'fy' | 'all' | 'custom';

function fyStart(t: string) {
  const [y, m] = t.split('-').map(Number) as [number, number];
  return `${m >= 7 ? y : y - 1}-07-01`;
}

export function SalesView() {
  const t = today();
  const [preset, setPreset] = useState<Preset>('90');
  const [from, setFrom] = useState(addDaysToDateKey(t, -90));
  const [to, setTo] = useState(t);
  const { data, error, loading, reload } = useRepo(async (r) => {
    const [sales, cars] = await Promise.all([r.listSales(), r.listCars({ includeDeleted: true })]);
    const users = await r.listUsers().catch(() => []);
    return { sales, cars: new Map(cars.map((c) => [c.id, c])), names: new Map(users.map((u) => [u.id, u.name])) };
  }, []);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === '30') { setFrom(addDaysToDateKey(t, -30)); setTo(t); }
    if (p === '90') { setFrom(addDaysToDateKey(t, -90)); setTo(t); }
    if (p === 'fy') { setFrom(fyStart(t)); setTo(t); }
    if (p === 'all') { setFrom(''); setTo(''); }
  }

  const rows = useMemo(
    () => (data?.sales ?? []).filter((s) => { const k = dateKey(s.saleDate); return (!from || k >= from) && (!to || k <= to); }),
    [data, from, to],
  );
  const total = rows.reduce((a, s) => ({ ex: a.ex + s.salePriceCents, gst: a.gst + s.saleGstCents }), { ex: 0, gst: 0 });

  return (
    <>
      <PageHeader title="Sales" description={data ? `${rows.length} sale${rows.length === 1 ? '' : 's'} · ${money(total.ex + total.gst)} inc GST` : undefined} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <ToggleGroup type="single" variant="outline" value={preset} onValueChange={(v) => v && applyPreset(v as Preset)} className="w-full lg:w-auto">
          <ToggleGroupItem value="30" className="flex-1 px-3">30 days</ToggleGroupItem>
          <ToggleGroupItem value="90" className="flex-1 px-3">90 days</ToggleGroupItem>
          <ToggleGroupItem value="fy" className="flex-1 px-3">This FY</ToggleGroupItem>
          <ToggleGroupItem value="all" className="flex-1 px-3">All</ToggleGroupItem>
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="sales-from" className="text-xs">From</Label>
            <Input id="sales-from" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sales-to" className="text-xs">To</Label>
            <Input id="sales-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} />
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No sales in this period">Sales are recorded from a car’s Sale tab (Mark sold).</EmptyState>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl border md:hidden">
            {rows.map((s) => {
              const car = data.cars.get(s.carId);
              return (
                <li key={s.id}>
                  <Link href={`/admin/cars/${s.carId}?tab=sale`} className="bg-card hover:bg-accent/50 block px-3 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{car ? carTitle(car) : s.stockNo}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{money(s.salePriceCents + s.saleGstCents)}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {dateAU(s.saleDate)} · {s.buyer.name} · {PAYMENT_METHOD_LABELS[s.paymentMethod]}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="bg-card hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="text-xs hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Car</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Ex GST</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const car = data.cars.get(s.carId);
                  return (
                    <TableRow key={s.id} className="cursor-pointer">
                      <TableCell className="text-muted-foreground whitespace-nowrap">{dateAU(s.saleDate)}</TableCell>
                      <TableCell>
                        <Link href={`/admin/cars/${s.carId}?tab=sale`} className="font-medium underline-offset-4 hover:underline">
                          {car ? carTitle(car) : s.stockNo}
                        </Link>
                        <div className="text-muted-foreground font-mono text-xs">{s.stockNo}</div>
                      </TableCell>
                      <TableCell>{s.buyer.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[s.paymentMethod]}
                        {s.tradeIn && <div className="text-xs">+ trade-in {money(s.tradeIn.valueCents)}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{data.names.get(s.salespersonUid) ?? '–'}</TableCell>
                      <TableCell className="text-right">{money(s.salePriceCents)}</TableCell>
                      <TableCell className="text-muted-foreground text-right">{money(s.saleGstCents)}</TableCell>
                      <TableCell className="text-right font-medium">{money(s.salePriceCents + s.saleGstCents)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right">{money(total.ex)}</TableCell>
                  <TableCell className="text-right">{money(total.gst)}</TableCell>
                  <TableCell className="text-right">{money(total.ex + total.gst)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
