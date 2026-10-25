/**
 * Turns raw collections (stored documents with Dates) into report inputs, applying the period / status /
 * category filters. Used by the export functions (after converting Firestore Timestamps with
 * `plainDates`) and by the admin demo mode (`reportSourceFromDemo(buildDemoDataset())`).
 */
import type { CarStatus } from '../constants';
import type { DemoDataset } from '../demo/dataset';
import { carTitle } from '../slug';
import { dateKeyInTz } from '../time';
import type {
  CarReportData,
  ReportCar,
  ReportContext,
  ReportExpense,
  ReportFinancials,
  ReportSale,
  StockReportData,
  StockReportFilters,
} from './types';
import { tzOf } from './sheet';

type Deleted = { deletedAt?: Date | null };

export interface SourceExpense extends Omit<ReportExpense, 'loggedBy'>, Deleted {
  /** uid */
  loggedBy: string;
}
export interface SourceSale extends Deleted {
  id: string;
  carId: string;
  saleDate: Date;
  salePriceCents: number;
  saleGstCents: number;
  buyer: { name: string };
  depositId?: string | null;
  tradeIn?: { valueCents: number } | null;
  paymentMethod: string;
  financeCompany?: string;
  salespersonUid: string;
}

/** Raw collections for the reports (plain objects, Dates not Timestamps). */
export interface ReportSource {
  cars: (ReportCar & Deleted)[];
  /** carFinancials docs; `id` = carId. */
  carFinancials: (ReportFinancials & { id: string } & Deleted)[];
  expenses: SourceExpense[];
  sales: SourceSale[];
  deposits: { id: string; amountCents: number; status?: string }[];
  /** For uid → display name. */
  users: { id: string; name: string }[];
}

/** Recursively converts Firestore Timestamps (anything with `toDate()`) into JS Dates. */
export function plainDates<T>(value: T): T {
  if (value instanceof Date || value == null) return value;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as unknown as { toDate(): Date }).toDate() as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => plainDates(v)) as unknown as T;
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, plainDates(v)])) as T;
  }
  return value;
}

/** The demo dataset as a ReportSource (admin demo mode / unit tests). */
export function reportSourceFromDemo(ds: DemoDataset): ReportSource {
  return {
    cars: ds.cars as unknown as ReportSource['cars'],
    carFinancials: ds.carFinancials as unknown as ReportSource['carFinancials'],
    expenses: ds.expenses as unknown as ReportSource['expenses'],
    sales: ds.sales as unknown as ReportSource['sales'],
    deposits: ds.deposits as unknown as ReportSource['deposits'],
    users: ds.users as unknown as ReportSource['users'],
  };
}

const alive = <T extends Deleted>(d: T) => !d.deletedAt;

function lookups(src: ReportSource) {
  const userName = new Map(src.users.map((u) => [u.id, u.name]));
  const name = (uid: string) =>
    userName.get(uid) ?? (uid === 'system' || uid === 'public' || uid === 'seed' ? 'System' : uid);
  const fin = new Map(src.carFinancials.filter(alive).map((f) => [f.id, f]));
  const deposit = new Map(src.deposits.map((d) => [d.id, d]));
  return { name, fin, deposit };
}

function toReportSale(s: SourceSale, l: ReturnType<typeof lookups>): ReportSale {
  return {
    id: s.id,
    carId: s.carId,
    saleDate: s.saleDate,
    salePriceCents: s.salePriceCents,
    saleGstCents: s.saleGstCents,
    buyerName: s.buyer?.name ?? '',
    depositCents: s.depositId ? (l.deposit.get(s.depositId)?.amountCents ?? 0) : 0,
    tradeInValueCents: s.tradeIn?.valueCents ?? 0,
    paymentMethod: s.paymentMethod,
    financeCompany: s.financeCompany ?? '',
    salesperson: l.name(s.salespersonUid),
  };
}

const toReportExpense = (e: SourceExpense, l: ReturnType<typeof lookups>): ReportExpense => ({
  id: e.id,
  carId: e.carId,
  date: e.date,
  category: e.category,
  description: e.description,
  vendorName: e.vendorName ?? '',
  invoiceNo: e.invoiceNo ?? '',
  amountExGstCents: e.amountExGstCents,
  gstCents: e.gstCents,
  totalCents: e.totalCents,
  receiptPath: e.receiptPath ?? null,
  loggedBy: l.name(e.loggedBy),
});

/** Car Report input for one car. Returns null when the car doesn't exist. */
export function carReportDataFromSource(src: ReportSource, carId: string, ctx: ReportContext): CarReportData | null {
  const car = src.cars.find((c) => c.id === carId);
  if (!car) return null;
  const l = lookups(src);
  const sale = src.sales.filter(alive).find((s) => s.carId === carId) ?? null;
  return {
    ...ctx,
    car,
    financials: l.fin.get(carId) ?? null,
    expenses: src.expenses.filter((e) => e.carId === carId && alive(e)).map((e) => toReportExpense(e, l)),
    sale: sale ? toReportSale(sale, l) : null,
  };
}

export interface StockReportQuery extends StockReportFilters {
  from: string;
  to: string;
}

/**
 * Stock & Sales Report input:
 * - Stock Summary: cars (not deleted, matching `status`) in stock at any point in [from, to]
 *   (purchased/created on or before `to`, and unsold or sold on/after `from`).
 * - Expenses: expenses dated in the period for those cars (matching `category`).
 * - Sales: sales dated in the period for those cars.
 */
export function stockReportDataFromSource(src: ReportSource, q: StockReportQuery, ctx: ReportContext): StockReportData {
  const tz = tzOf(ctx);
  const key = (d: Date | null | undefined) => (d ? dateKeyInTz(d, tz) : null);
  const inPeriod = (d: Date | null | undefined) => {
    const k = key(d);
    return k != null && k >= q.from && k <= q.to;
  };
  const l = lookups(src);
  const salesByCar = new Map(src.sales.filter(alive).map((s) => [s.carId, s]));
  const expensesByCar = new Map<string, SourceExpense[]>();
  for (const e of src.expenses.filter(alive)) {
    const list = expensesByCar.get(e.carId) ?? [];
    list.push(e);
    expensesByCar.set(e.carId, list);
  }

  const cars = src.cars.filter((c) => {
    if (!alive(c)) return false;
    if (q.status && c.status !== (q.status as CarStatus)) return false;
    const start = key(l.fin.get(c.id)?.purchaseDate ?? c.createdAt ?? null);
    if (start && start > q.to) return false;
    const sale = salesByCar.get(c.id);
    const end = key(sale?.saleDate ?? c.soldAt ?? null);
    if (end && end < q.from) return false;
    return true;
  });
  const carById = new Map(cars.map((c) => [c.id, c]));

  return {
    ...ctx,
    from: q.from,
    to: q.to,
    filters: { status: q.status, category: q.category },
    stock: cars.map((car) => {
      const sale = salesByCar.get(car.id);
      return {
        car,
        financials: l.fin.get(car.id) ?? null,
        expensesExGstCents: (expensesByCar.get(car.id) ?? []).reduce((s, e) => s + e.amountExGstCents, 0),
        sale: sale ? toReportSale(sale, l) : null,
      };
    }),
    expenses: src.expenses
      .filter((e) => alive(e) && carById.has(e.carId) && inPeriod(e.date) && (!q.category || e.category === q.category))
      .map((e) => {
        const car = carById.get(e.carId)!;
        return { ...toReportExpense(e, l), stockNo: car.stockNo, carTitle: carTitle(car) };
      }),
    sales: src.sales
      .filter((s) => alive(s) && carById.has(s.carId) && inPeriod(s.saleDate))
      .map((s) => {
        const car = carById.get(s.carId)!;
        return { ...toReportSale(s, l), stockNo: car.stockNo, carTitle: carTitle(car) };
      }),
  };
}
