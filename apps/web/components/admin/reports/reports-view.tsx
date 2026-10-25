/**
 * /admin/reports (admin) – Car Report and Stock & Sales Report.
 * Firebase mode: the exportCarReport / exportStockReport callables build the file and return a 15-min URL.
 * Demo mode: the same builders from @sda/shared/reports run in the browser (exceljs, loaded on demand)
 * over the demo data, and the file downloads directly.
 */
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  addDaysToDateKey,
  CAR_STATUS_LABELS,
  CAR_STATUSES,
  type CarStatus,
  carTitle,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { actionErrorMessage, type AdminRepository, DEMO_MODE, getAdminRepo, runAction } from '@/lib/data';
import { today, TZ } from '../format';
import { useRepo } from '../use-data';
import { AdminOnly, PageHeader, Panel } from '../ui';

type Format = 'xlsx' | 'csv-stock' | 'csv-expenses';

function download(body: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Demo: gather the same source shape the functions load from Firestore. */
async function demoSource(repo: AdminRepository) {
  const [cars, expenses, sales, deposits, users, business] = await Promise.all([
    repo.listCars({ includeDeleted: true }),
    repo.listExpenses(),
    repo.listSales(),
    repo.listDeposits(),
    repo.listUsers(),
    repo.getSettings('business'),
  ]);
  const fin = (await Promise.all(cars.map((c) => repo.getCarFinancials(c.id)))).filter(Boolean);
  return {
    src: {
      cars,
      carFinancials: fin,
      expenses,
      sales,
      deposits: deposits.map((d) => ({ id: d.id, amountCents: d.amountCents, status: d.status })),
      users: users.map((u) => ({ id: u.id, name: u.name })),
    },
    ctx: { businessName: business.name, timezone: business.timezone || TZ, siteUrl: window.location.origin, generatedAt: new Date() },
  };
}

async function exportCar(carId: string) {
  if (!DEMO_MODE) {
    const res = await runAction('exportCarReport', { carId });
    window.location.assign(res.url);
    return res.fileName;
  }
  const R = await import('@sda/shared/reports');
  const { src, ctx } = await demoSource(getAdminRepo());
  const data = R.carReportDataFromSource(src as never, carId, ctx);
  if (!data) throw new Error('Car not found');
  const fileName = R.carReportFileName(data.car);
  download(await R.buildCarReport(data).xlsx.writeBuffer(), fileName, R.XLSX_CONTENT_TYPE);
  return fileName;
}

async function exportStock(input: { from: string; to: string; status?: CarStatus; category?: ExpenseCategory; format: Format }) {
  if (!DEMO_MODE) {
    const res = await runAction('exportStockReport', input);
    window.location.assign(res.url);
    return res.fileName;
  }
  const R = await import('@sda/shared/reports');
  const { src, ctx } = await demoSource(getAdminRepo());
  const data = R.stockReportDataFromSource(src as never, input, ctx);
  if (input.format === 'csv-stock') {
    const name = R.stockReportFileName(input.from, input.to, 'csv', 'StockSummary');
    download(R.stockSummaryCsv(data, { bom: true }), name, R.CSV_CONTENT_TYPE);
    return name;
  }
  if (input.format === 'csv-expenses') {
    const name = R.stockReportFileName(input.from, input.to, 'csv', 'Expenses');
    download(R.expensesCsv(data, { bom: true }), name, R.CSV_CONTENT_TYPE);
    return name;
  }
  const name = R.stockReportFileName(input.from, input.to);
  download(await R.buildStockReport(data).xlsx.writeBuffer(), name, R.XLSX_CONTENT_TYPE);
  return name;
}

function Reports() {
  const t = today();
  const { data: cars } = useRepo((r) => r.listCars({ includeDeleted: true }), []);
  const [carId, setCarId] = useState('');
  const [from, setFrom] = useState(addDaysToDateKey(t, -90));
  const [to, setTo] = useState(t);
  const [status, setStatus] = useState<'all' | CarStatus>('all');
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all');
  const [format, setFormat] = useState<Format>('xlsx');
  const [busy, setBusy] = useState<'car' | 'stock' | null>(null);
  const sortedCars = useMemo(() => [...(cars ?? [])].sort((a, b) => a.stockNo.localeCompare(b.stockNo)), [cars]);

  async function run(kind: 'car' | 'stock', fn: () => Promise<string>) {
    setBusy(kind);
    try {
      const name = await fn();
      toast.success(DEMO_MODE ? `Downloaded ${name}` : `${name} is ready – downloading`);
    } catch (e) {
      toast.error(actionErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Reports" description="Excel exports with live formulas – open in Excel or Google Sheets." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Car Report" description="One car: summary with profit, every expense, totals by category.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-car">Car</Label>
              <Select value={carId} onValueChange={setCarId}>
                <SelectTrigger id="report-car" className="w-full">
                  <SelectValue placeholder="Choose a car" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono text-xs">{c.stockNo}</span> {carTitle(c)} · {CAR_STATUS_LABELS[c.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full sm:w-auto" disabled={!carId || !!busy} onClick={() => void run('car', () => exportCar(carId))}>
              {busy === 'car' ? <Loader2 className="animate-spin" /> : <Download />}
              Download .xlsx
            </Button>
          </div>
        </Panel>

        <Panel title="Stock & Sales Report" description="Overview, stock summary, expenses, sales and categories for a period.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-from">From</Label>
              <Input id="report-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">To</Label>
              <Input id="report-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Car status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {CAR_STATUSES.map((s) => <SelectItem key={s} value={s}>{CAR_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expense category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Format</Label>
              <ToggleGroup type="single" variant="outline" value={format} onValueChange={(v) => v && setFormat(v as Format)} className="w-full">
                <ToggleGroupItem value="xlsx" className="flex-1">Excel</ToggleGroupItem>
                <ToggleGroupItem value="csv-stock" className="flex-1">CSV · stock</ToggleGroupItem>
                <ToggleGroupItem value="csv-expenses" className="flex-1">CSV · expenses</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="sm:col-span-2">
              <Button
                className="w-full sm:w-auto"
                disabled={!from || !to || from > to || !!busy}
                onClick={() =>
                  void run('stock', () =>
                    exportStock({ from, to, format, ...(status !== 'all' ? { status } : {}), ...(category !== 'all' ? { category } : {}) }),
                  )
                }
              >
                {busy === 'stock' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                Download {format === 'xlsx' ? '.xlsx' : '.csv'}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        {DEMO_MODE
          ? 'Preview: files are built in your browser from the sample data plus your changes.'
          : 'Download links last 15 minutes. Files are deleted from storage after 24 hours.'}
      </p>
    </>
  );
}

export function ReportsView() {
  return (
    <AdminOnly>
      <Reports />
    </AdminOnly>
  );
}
