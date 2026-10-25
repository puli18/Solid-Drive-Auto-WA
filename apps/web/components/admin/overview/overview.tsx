import { CalendarDays, Clock, Inbox } from 'lucide-react';
import Link from '@/components/link';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  addDaysToDateKey,
  BOOKING_TYPE_LABELS,
  carTitle,
  daysBetween,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  formatInTz,
  profitSummary,
} from '@sda/shared';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import type { AdminRepository } from '@/lib/data';
import { cn } from '@/lib/utils';
import { dateKey, money, relativeDays, timeAU, today, TZ } from '../format';
import { useRepo } from '../use-data';
import { CarStatusBadge, EmptyState, ErrorState, PageHeader, Panel } from '../ui';

const IN_STOCK = new Set(['draft', 'available', 'reserved']);

async function loadOverview(repo: AdminRepository, isAdmin: boolean) {
  const [cars, bookings, enquiries, sales, app] = await Promise.all([
    repo.listCars(),
    repo.listBookings(),
    repo.listEnquiries(),
    repo.listSales(),
    repo.getSettings('app'),
  ]);
  let admin: null | { financials: Map<string, { purchasePriceCents: number }>; expenses: Awaited<ReturnType<AdminRepository['listExpenses']>> } =
    null;
  if (isAdmin) {
    const [fin, expenses] = await Promise.all([Promise.all(cars.map((c) => repo.getCarFinancials(c.id))), repo.listExpenses()]);
    admin = {
      financials: new Map(fin.filter(Boolean).map((f) => [f!.id, f!])),
      expenses,
    };
  }
  return { cars, bookings, enquiries, sales, app, admin };
}

const ageConfig = { cars: { label: 'Cars', color: 'var(--chart-2)' } } satisfies ChartConfig;
const bookingConfig = { count: { label: 'Bookings', color: 'var(--chart-1)' } } satisfies ChartConfig;
const expenseConfig = { amount: { label: 'Ex GST', color: 'var(--chart-2)' } } satisfies ChartConfig;

function Kpi({ label, value, hint, href, tone }: { label: string; value: string | number; hint?: string; href?: string; tone?: 'alert' }) {
  const body = (
    <>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className={cn('page-title mt-1 text-2xl font-bold tabular-nums sm:text-[1.65rem]', tone === 'alert' && 'text-primary')}>{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 truncate text-xs">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="hover:bg-accent/60 block px-4 py-3 transition-colors">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-3">{body}</div>
  );
}

export function Overview() {
  const { isAdmin, user } = useAuth();
  const { data, error, loading, reload } = useRepo((r) => loadOverview(r, isAdmin), [isAdmin]);

  const m = useMemo(() => {
    if (!data) return null;
    const { cars, bookings, enquiries, sales, app, admin } = data;
    const t = today();
    const month = t.slice(0, 7);
    const inStock = cars.filter((c) => IN_STOCK.has(c.status));
    const aged = inStock
      .map((c) => ({ car: c, days: daysBetween(c.createdAt, new Date()) }))
      .filter((x) => x.days > app.agedStockDays)
      .sort((a, b) => b.days - a.days);
    const salesThisMonth = sales.filter((s) => dateKey(s.saleDate).startsWith(month));
    const todays = bookings.filter((b) => dateKey(b.startAt) === t && b.status !== 'cancelled');
    const upcoming = bookings.filter((b) => b.startAt.getTime() >= Date.now() - 3_600_000 && b.status === 'confirmed').slice(0, 6);
    const newEnquiries = enquiries.filter((e) => e.status === 'new');

    const buckets = [
      { label: '0–30', min: 0, max: 30 },
      { label: '31–60', min: 31, max: 60 },
      { label: '61–90', min: 61, max: 90 },
      { label: '90+', min: 91, max: Infinity },
    ].map((b) => ({ bucket: `${b.label} d`, cars: inStock.filter((c) => { const d = daysBetween(c.createdAt, new Date()); return d >= b.min && d <= b.max; }).length }));

    const week = Array.from({ length: 7 }, (_, i) => {
      const key = addDaysToDateKey(t, i);
      return {
        day: i === 0 ? 'Today' : formatInTz(new Date(`${key}T12:00:00+08:00`), 'EEE', TZ),
        count: bookings.filter((b) => dateKey(b.startAt) === key && b.status !== 'cancelled').length,
      };
    });

    let money_ = null as null | {
      stockAtCost: number;
      expensesMonth: number;
      profitMonth: number;
      expensesByMonth: { month: string; amount: number }[];
      topCategories: { cat: string; amount: number }[];
    };
    if (admin) {
      const expByCar = new Map<string, number>();
      for (const e of admin.expenses) expByCar.set(e.carId, (expByCar.get(e.carId) ?? 0) + e.amountExGstCents);
      const stockAtCost = inStock.reduce((s, c) => s + (admin.financials.get(c.id)?.purchasePriceCents ?? 0) + (expByCar.get(c.id) ?? 0), 0);
      const monthExp = admin.expenses.filter((e) => dateKey(e.date).startsWith(month));
      const expensesMonth = monthExp.reduce((s, e) => s + e.amountExGstCents, 0);
      const profitMonth = salesThisMonth.reduce((s, sale) => {
        const p = profitSummary({
          purchasePriceExGstCents: admin.financials.get(sale.carId)?.purchasePriceCents ?? 0,
          expensesExGstCents: expByCar.get(sale.carId) ?? 0,
          salePriceExGstCents: sale.salePriceCents,
        });
        return s + (p.grossProfitCents ?? 0);
      }, 0);
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(`${month}-15T00:00:00+08:00`);
        d.setMonth(d.getMonth() - (5 - i));
        return formatInTz(d, 'yyyy-MM', TZ);
      });
      const expensesByMonth = months.map((mk) => ({
        month: formatInTz(new Date(`${mk}-15T00:00:00+08:00`), 'MMM', TZ),
        amount: admin.expenses.filter((e) => dateKey(e.date).startsWith(mk)).reduce((s, e) => s + e.amountExGstCents, 0) / 100,
      }));
      const cats = new Map<string, number>();
      for (const e of monthExp) cats.set(e.category, (cats.get(e.category) ?? 0) + e.amountExGstCents);
      const topCategories = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amount]) => ({ cat, amount }));
      money_ = { stockAtCost, expensesMonth, profitMonth, expensesByMonth, topCategories };
    }

    return {
      inStock: inStock.length,
      available: cars.filter((c) => c.status === 'available').length,
      reserved: cars.filter((c) => c.status === 'reserved').length,
      soldMonth: salesThisMonth.length,
      todays,
      upcoming,
      newEnquiries,
      aged,
      agedDays: app.agedStockDays,
      buckets,
      week,
      money: money_,
      carsById: new Map(cars.map((c) => [c.id, c])),
    };
  }, [data]);

  const firstName = user?.displayName?.split(' ')[0];

  return (
    <>
      <PageHeader title={firstName ? `G'day, ${firstName}` : 'Overview'} description={formatInTz(new Date(), 'EEEE d MMMM', TZ)} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !m ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0 [&>*]:border-border">
            <Kpi label="In stock" value={m.inStock} hint={`${m.available} available`} href="/admin/cars" />
            <Kpi label="Reserved" value={m.reserved} href="/admin/cars?status=reserved" />
            <Kpi label="Sold this month" value={m.soldMonth} href="/admin/sales" />
            <Kpi label="Today's bookings" value={m.todays.length} href="/admin/bookings" />
            <Kpi label="New enquiries" value={m.newEnquiries.length} href="/admin/enquiries" tone={m.newEnquiries.length ? 'alert' : undefined} />
            <Kpi label="Aged stock" value={m.aged.length} hint={`Over ${m.agedDays} days`} href="/admin/cars?aged=1" tone={m.aged.length ? 'alert' : undefined} />
          </div>

          {m.money && (
            <div className="bg-card grid grid-cols-1 divide-y overflow-hidden rounded-xl border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Kpi label="Stock value at cost" value={money(m.money.stockAtCost)} hint="Purchase + expenses, ex GST" />
              <Kpi label="Expenses this month" value={money(m.money.expensesMonth)} hint="Ex GST" />
              <Kpi label="Gross profit this month" value={money(m.money.profitMonth)} hint={`${m.soldMonth} sale${m.soldMonth === 1 ? '' : 's'}, ex GST`} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Coming up"
              description="Confirmed bookings"
              action={<Link href="/admin/bookings" className="text-muted-foreground hover:text-foreground text-xs font-medium">All bookings</Link>}
              bodyClassName="p-0"
            >
              {m.upcoming.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={CalendarDays} title="No upcoming bookings">New web and phone bookings appear here.</EmptyState>
                </div>
              ) : (
                <ul className="divide-y">
                  {m.upcoming.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-20 shrink-0">
                        <div className="text-muted-foreground text-[11px] uppercase">{dateKey(b.startAt) === today() ? 'Today' : formatInTz(b.startAt, 'EEE d MMM', TZ)}</div>
                        <div className="text-sm font-semibold whitespace-nowrap tabular-nums">{timeAU(b.startAt)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{b.customer.name}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {BOOKING_TYPE_LABELS[b.type]} · {b.carTitle ?? m.carsById.get(b.carId)?.model}
                        </div>
                      </div>
                      <a href={`tel:${b.customer.phone.replace(/\s/g, '')}`} className="text-muted-foreground hover:text-foreground text-xs tabular-nums">
                        {b.customer.phone}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="Bookings, next 7 days">
              <ChartContainer config={bookingConfig} className="aspect-auto h-48 w-full">
                <BarChart data={m.week} margin={{ left: -24, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="New enquiries"
              action={<Link href="/admin/enquiries" className="text-muted-foreground hover:text-foreground text-xs font-medium">Inbox</Link>}
              bodyClassName="p-0"
            >
              {m.newEnquiries.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={Inbox} title="Inbox zero">Nothing new to follow up.</EmptyState>
                </div>
              ) : (
                <ul className="divide-y">
                  {m.newEnquiries.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <Link href={`/admin/enquiries?id=${e.id}`} className="hover:bg-accent/50 flex items-start gap-3 px-4 py-3 transition-colors">
                        <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium">{e.customer.name}</span>
                            <span className="text-muted-foreground shrink-0 text-xs">{relativeDays(e.createdAt)}</span>
                          </div>
                          <p className="text-muted-foreground line-clamp-1 text-xs">
                            {e.type === 'trade-in' ? 'Trade-in · ' : e.carTitle ? `${e.carTitle} · ` : ''}
                            {e.message}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="Stock age" description="Days since the car was added">
              <ChartContainer config={ageConfig} className="aspect-auto h-48 w-full">
                <BarChart data={m.buckets} margin={{ left: -24, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                  <Bar dataKey="cars" fill="var(--color-cars)" radius={4} maxBarSize={36} />
                </BarChart>
              </ChartContainer>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Panel
              className={m.money ? 'lg:col-span-3' : 'lg:col-span-5'}
              title={`Aged stock (over ${m.agedDays} days)`}
              description="Consider a price review or promotion"
              bodyClassName="p-0"
            >
              {m.aged.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={Clock} title="Nothing aged">Every car in stock is under {m.agedDays} days.</EmptyState>
                </div>
              ) : (
                <ul className="divide-y">
                  {m.aged.slice(0, 6).map(({ car, days }) => (
                    <li key={car.id}>
                      <Link href={`/admin/cars/${car.id}`} className="hover:bg-accent/50 flex items-center gap-3 px-4 py-2.5 transition-colors">
                        <span className="text-muted-foreground w-16 shrink-0 font-mono text-xs">{car.stockNo}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{carTitle(car)}</span>
                        <CarStatusBadge status={car.status} className="hidden sm:inline-flex" />
                        <span className="text-primary w-14 shrink-0 text-right text-sm font-semibold tabular-nums">{days} d</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {m.money && (
              <Panel className="lg:col-span-2" title="Expenses, last 6 months" description="Ex GST, all cars">
                <ChartContainer config={expenseConfig} className="aspect-auto h-40 w-full">
                  <BarChart data={m.money.expensesByMonth} margin={{ left: -8, right: 4, top: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator formatter={(v) => money(Math.round(Number(v) * 100))} />} />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={4} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
                {m.money.topCategories.length > 0 && (
                  <dl className="mt-3 border-t pt-2">
                    {m.money.topCategories.map((c) => (
                      <div key={c.cat} className="flex justify-between py-1 text-xs">
                        <dt className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[c.cat as ExpenseCategory]}</dt>
                        <dd className="tabular-nums">{money(c.amount)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
