/**
 * Plain-data inputs for the Excel/CSV report builders (`@sda/shared/reports`).
 * All money is integer cents (AUD), all instants are JS `Date`s. Nothing here depends on Firestore,
 * so the same builders run in Cloud Functions and in the browser (admin demo mode).
 */
import type { CarStatus } from '../constants';

/** Context shared by every report. */
export interface ReportContext {
  /** Business name for the sheet header (settings/business.name). */
  businessName: string;
  /** Dealership time zone (default Australia/Perth). Dates are written as calendar dates in this zone. */
  timezone?: string;
  /** Absolute site origin for receipt hyperlinks, e.g. https://soliddrive.com.au (default: relative links). */
  siteUrl?: string;
  /** "Now" for days-in-stock and the footer (default new Date()). */
  generatedAt?: Date;
}

export interface ReportCar {
  id: string;
  stockNo: string;
  vin?: string;
  rego?: string;
  year: number;
  make: string;
  model: string;
  variant?: string;
  km: number;
  status: CarStatus | string;
  /** List price (drive-away, GST inclusive) in cents. */
  priceCents: number;
  createdAt?: Date | null;
  soldAt?: Date | null;
}

export interface ReportFinancials {
  purchaseDate: Date | null;
  /** Purchase price EXCLUDING GST. */
  purchasePriceCents: number;
  purchaseGstCents?: number;
}

export interface ReportExpense {
  id: string;
  carId: string;
  date: Date;
  /** Expense category key (e.g. "tyres"); rendered with EXPENSE_CATEGORY_LABELS. */
  category: string;
  description: string;
  vendorName: string;
  invoiceNo: string;
  amountExGstCents: number;
  gstCents: number;
  totalCents: number;
  /** Storage path under receipts/…; rendered as a link to /admin/receipts/{path}. */
  receiptPath?: string | null;
  /** Display name of the user who logged it (resolve uids before building). */
  loggedBy: string;
}

export interface ReportSale {
  id: string;
  carId: string;
  saleDate: Date;
  /** Sale price EXCLUDING GST. */
  salePriceCents: number;
  saleGstCents: number;
  buyerName: string;
  /** Linked deposit amount in cents (0 / undefined when none). */
  depositCents?: number;
  tradeInValueCents?: number;
  /** Payment method key (e.g. "bank-transfer"); rendered with PAYMENT_METHOD_LABELS. */
  paymentMethod: string;
  financeCompany?: string;
  /** Salesperson display name. */
  salesperson: string;
}

/** Input for `buildCarReport`. */
export interface CarReportData extends ReportContext {
  car: ReportCar;
  financials: ReportFinancials | null;
  expenses: ReportExpense[];
  sale: ReportSale | null;
}

export interface StockReportRow {
  car: ReportCar;
  financials: ReportFinancials | null;
  /** Lifetime expenses ex GST for the car (used for gross profit). */
  expensesExGstCents: number;
  sale: ReportSale | null;
}

export interface StockReportFilters {
  status?: CarStatus;
  category?: string;
}

/** Input for `buildStockReport`. `from`/`to` are inclusive YYYY-MM-DD dates in the dealership zone. */
export interface StockReportData extends ReportContext {
  from: string;
  to: string;
  filters?: StockReportFilters;
  /** Stock Summary rows (cars in stock at any time during the period). */
  stock: StockReportRow[];
  /** Expenses dated within the period (with car details for the sheet). */
  expenses: (ReportExpense & { stockNo: string; carTitle: string })[];
  /** Sales dated within the period. */
  sales: (ReportSale & { stockNo: string; carTitle: string })[];
}
