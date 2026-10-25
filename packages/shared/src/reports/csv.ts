/**
 * CSV exports (Stock Summary / Expenses only) for future accounting imports.
 * RFC 4180: CRLF line endings, fields quoted when needed. Money as plain decimals (1234.50),
 * dates dd/mm/yyyy in the dealership zone. Computed columns (gross profit, margin) are values here.
 */
import { carTitle } from '../slug';
import { daysBetween, formatDateAU } from '../time';
import { categoryLabel, statusLabel, tzOf } from './sheet';
import { STOCK_EXPENSE_COLUMNS, STOCK_SUMMARY_COLUMNS } from './stock-report';
import type { StockReportData } from './types';

export interface CsvOptions {
  /** Prepend a UTF-8 BOM (helps Excel detect UTF-8). Default false. */
  bom?: boolean;
}

export function csvField(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][], opts: CsvOptions = {}): string {
  const body = rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
  return (opts.bom ? '﻿' : '') + body;
}

const money = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2));

export function stockSummaryCsv(data: StockReportData, opts: CsvOptions = {}): string {
  const tz = tzOf(data);
  const now = data.generatedAt ?? new Date();
  const d = (x: Date | null | undefined) => (x ? formatDateAU(x, tz) : '');
  const rows = [...data.stock]
    .sort((a, b) => a.car.stockNo.localeCompare(b.car.stockNo))
    .map((r) => {
      const purchase = r.financials?.purchasePriceCents ?? 0;
      const sale = r.sale?.salePriceCents ?? null;
      const gross = sale == null ? null : sale - purchase - r.expensesExGstCents;
      const margin = sale == null || sale === 0 || gross == null ? '' : ((gross / sale) * 100).toFixed(2);
      const start = r.financials?.purchaseDate ?? r.car.createdAt ?? null;
      return [
        r.car.stockNo,
        carTitle(r.car),
        r.car.vin ?? '',
        r.car.rego ?? '',
        statusLabel(String(r.car.status)),
        d(r.financials?.purchaseDate),
        money(purchase),
        money(r.expensesExGstCents),
        money(r.car.priceCents),
        money(sale),
        d(r.sale?.saleDate),
        money(gross),
        margin,
        start ? daysBetween(start, r.sale?.saleDate ?? r.car.soldAt ?? now) : '',
      ];
    });
  return toCsv([STOCK_SUMMARY_COLUMNS.map((c) => c.header), ...rows], opts);
}

export function expensesCsv(data: StockReportData, opts: CsvOptions = {}): string {
  const tz = tzOf(data);
  const rows = [...data.expenses]
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.stockNo.localeCompare(b.stockNo))
    .map((e) => [
      e.stockNo,
      e.carTitle,
      formatDateAU(e.date, tz),
      categoryLabel(e.category),
      e.description,
      e.vendorName,
      e.invoiceNo,
      money(e.amountExGstCents),
      money(e.gstCents),
      money(e.totalCents),
      e.loggedBy,
    ]);
  return toCsv([STOCK_EXPENSE_COLUMNS.map((c) => c.header), ...rows], opts);
}
