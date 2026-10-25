/**
 * Stock & Sales Report – `StockReport_{from}_to_{to}.xlsx`
 * Sheets: Overview, Stock Summary, Expenses, Sales, By Category. Totals and profit are formulas.
 */
import type ExcelJS from 'exceljs';
import { carTitle } from '../slug';
import { daysBetween, formatDateAU } from '../time';
import {
  addSheet,
  categoryLabel,
  colLetter,
  dataRange,
  dollars,
  excelDate,
  excelDateExpr,
  fitColumns,
  INT_FMT,
  MONEY_FMT,
  newWorkbook,
  paymentLabel,
  PCT_FMT,
  round2,
  statusLabel,
  styleTotalsRow,
  sumFormula,
  tzOf,
  type ColumnDef,
} from './sheet';
import type { StockReportData } from './types';

export const STOCK_REPORT_SHEETS = ['Overview', 'Stock Summary', 'Expenses', 'Sales', 'By Category'] as const;

const c = (header: string, kind: ColumnDef['kind'] = 'text'): ColumnDef => ({ header, kind });

export const STOCK_SUMMARY_COLUMNS: ColumnDef[] = [
  c('Stock no'),
  c('Car'),
  c('VIN'),
  c('Rego'),
  c('Status'),
  c('Purchase date', 'date'),
  c('Purchase price', 'money'),
  c('Expenses total', 'money'),
  c('List price', 'money'),
  c('Sale price', 'money'),
  c('Sale date', 'date'),
  c('Gross profit', 'money'),
  c('Margin %', 'pct'),
  c('Days in stock', 'int'),
];
export const STOCK_EXPENSE_COLUMNS: ColumnDef[] = [
  c('Stock no'),
  c('Car'),
  c('Date', 'date'),
  c('Category'),
  c('Description'),
  c('Vendor'),
  c('Invoice no'),
  c('Amount ex GST', 'money'),
  c('GST', 'money'),
  c('Total inc GST', 'money'),
  c('Logged by'),
];
export const STOCK_SALES_COLUMNS: ColumnDef[] = [
  c('Stock no'),
  c('Car'),
  c('Sale date', 'date'),
  c('Buyer'),
  c('Sale price ex GST', 'money'),
  c('GST', 'money'),
  c('Deposit', 'money'),
  c('Trade-in value', 'money'),
  c('Payment method'),
  c('Finance company'),
  c('Salesperson'),
];
export const STOCK_CATEGORY_COLUMNS: ColumnDef[] = [
  c('Category'),
  c('Amount ex GST', 'money'),
  c('GST', 'money'),
  c('Total inc GST', 'money'),
];
export const STOCK_OVERVIEW_LABELS = [
  'Period',
  'Cars purchased',
  'Cars sold',
  'Revenue ex GST',
  'Expenses ex GST',
  'Gross profit',
  'Average margin %',
  'Average days to sell',
] as const;

/** `StockReport_2026-07-01_to_2026-09-30.xlsx` (or .csv variants). */
export function stockReportFileName(from: string, to: string, ext: 'xlsx' | 'csv' = 'xlsx', suffix = ''): string {
  return `StockReport_${from}_to_${to}${suffix ? `_${suffix}` : ''}.${ext}`;
}

export function stockReportPeriodLabel(from: string, to: string): string {
  const f = (k: string) => k.split('-').reverse().join('/');
  return `${f(from)} – ${f(to)}`;
}

export function buildStockReport(data: StockReportData): ExcelJS.Workbook {
  const tz = tzOf(data);
  const now = data.generatedAt ?? new Date();
  const period = stockReportPeriodLabel(data.from, data.to);
  const filterBits = [
    data.filters?.status ? `status: ${statusLabel(data.filters.status)}` : '',
    data.filters?.category ? `category: ${categoryLabel(data.filters.category)}` : '',
  ].filter(Boolean);
  const periodLabel = filterBits.length ? `${period} (${filterBits.join(', ')})` : period;
  const wb = newWorkbook(data, `Stock & Sales Report ${period}`);

  const overview = addSheet(wb, 'Overview', [c('Item'), c('Value')], data, periodLabel);
  const stock = addSheet(wb, 'Stock Summary', STOCK_SUMMARY_COLUMNS, data, periodLabel);
  const exp = addSheet(wb, 'Expenses', STOCK_EXPENSE_COLUMNS, data, periodLabel);
  const sales = addSheet(wb, 'Sales', STOCK_SALES_COLUMNS, data, periodLabel);
  const byCat = addSheet(wb, 'By Category', STOCK_CATEGORY_COLUMNS, data, periodLabel);

  // ---- Stock Summary ----
  const rows = [...data.stock].sort((a, b) => a.car.stockNo.localeCompare(b.car.stockNo));
  const sFirst = 2;
  const sLast = sFirst + rows.length - 1;
  const results = { purchase: 0, expenses: 0, list: 0, sale: 0, gross: 0 };
  rows.forEach((row, i) => {
    const r = sFirst + i;
    const purchase = dollars(row.financials?.purchasePriceCents ?? 0)!;
    const expTotal = dollars(row.expensesExGstCents)!;
    const sale = row.sale ? dollars(row.sale.salePriceCents)! : null;
    const gross = sale == null ? '' : round2(sale - purchase - expTotal);
    const margin = sale == null || sale === 0 || gross === '' ? '' : (gross as number) / sale;
    const start = row.financials?.purchaseDate ?? row.car.createdAt ?? null;
    const end = row.sale?.saleDate ?? row.car.soldAt ?? null;
    results.purchase += purchase;
    results.expenses += expTotal;
    results.list += dollars(row.car.priceCents)!;
    results.sale += sale ?? 0;
    results.gross += typeof gross === 'number' ? gross : 0;
    stock.getRow(r).values = [
      row.car.stockNo,
      carTitle(row.car),
      row.car.vin ?? '',
      row.car.rego ?? '',
      statusLabel(String(row.car.status)),
      excelDate(row.financials?.purchaseDate ?? null, tz) ?? '',
      purchase,
      expTotal,
      dollars(row.car.priceCents),
      sale ?? '',
      excelDate(row.sale?.saleDate ?? null, tz) ?? '',
      { formula: `IF(J${r}="","",J${r}-G${r}-H${r})`, result: gross },
      { formula: `IF(OR(J${r}="",J${r}=0),"",L${r}/J${r})`, result: margin },
      start ? daysBetween(start, end ?? now) : '',
    ];
  });
  const sTot = stock.getRow(sLast + 1);
  sTot.getCell(1).value = 'Total';
  (
    [
      ['G', results.purchase],
      ['H', results.expenses],
      ['I', results.list],
      ['J', results.sale],
      ['L', results.gross],
    ] as const
  ).forEach(([col, result]) => {
    sTot.getCell(col).value = { formula: sumFormula(col, sFirst, sLast), result: round2(result) };
  });
  styleTotalsRow(sTot, STOCK_SUMMARY_COLUMNS.length);

  // ---- Expenses ----
  const expenses = [...data.expenses].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.stockNo.localeCompare(b.stockNo),
  );
  const eFirst = 2;
  const eLast = eFirst + expenses.length - 1;
  expenses.forEach((e, i) => {
    exp.getRow(eFirst + i).values = [
      e.stockNo,
      e.carTitle,
      excelDate(e.date, tz),
      categoryLabel(e.category),
      e.description,
      e.vendorName,
      e.invoiceNo,
      dollars(e.amountExGstCents),
      dollars(e.gstCents),
      dollars(e.totalCents),
      e.loggedBy,
    ];
  });
  const esum = (f: (e: (typeof expenses)[number]) => number, list = expenses) =>
    round2(list.reduce((s, e) => s + f(e), 0) / 100);
  const eTotals = [esum((e) => e.amountExGstCents), esum((e) => e.gstCents), esum((e) => e.totalCents)];
  const eTot = exp.getRow(eLast + 1);
  eTot.getCell(1).value = 'Total';
  (['H', 'I', 'J'] as const).forEach((col, k) => {
    eTot.getCell(col).value = { formula: sumFormula(col, eFirst, eLast), result: eTotals[k]! };
  });
  styleTotalsRow(eTot, STOCK_EXPENSE_COLUMNS.length);

  // ---- Sales ----
  const saleRows = [...data.sales].sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());
  const slFirst = 2;
  const slLast = slFirst + saleRows.length - 1;
  saleRows.forEach((s, i) => {
    sales.getRow(slFirst + i).values = [
      s.stockNo,
      s.carTitle,
      excelDate(s.saleDate, tz),
      s.buyerName,
      dollars(s.salePriceCents),
      dollars(s.saleGstCents),
      dollars(s.depositCents ?? 0),
      dollars(s.tradeInValueCents ?? 0),
      paymentLabel(s.paymentMethod),
      s.financeCompany ?? '',
      s.salesperson,
    ];
  });
  const ssum = (f: (s: (typeof saleRows)[number]) => number) => round2(saleRows.reduce((a, s) => a + f(s), 0) / 100);
  const slTotals = [
    ssum((s) => s.salePriceCents),
    ssum((s) => s.saleGstCents),
    ssum((s) => s.depositCents ?? 0),
    ssum((s) => s.tradeInValueCents ?? 0),
  ];
  const slTot = sales.getRow(slLast + 1);
  slTot.getCell(1).value = 'Total';
  (['E', 'F', 'G', 'H'] as const).forEach((col, k) => {
    slTot.getCell(col).value = { formula: sumFormula(col, slFirst, slLast), result: slTotals[k]! };
  });
  styleTotalsRow(slTot, STOCK_SALES_COLUMNS.length);

  // ---- By Category (SUMIF against Expenses) ----
  const cats = [...new Set(expenses.map((e) => categoryLabel(e.category)))].sort();
  const catRange = dataRange('D', eFirst, eLast, 'Expenses', true);
  cats.forEach((label, i) => {
    const rowNo = 2 + i;
    const inCat = expenses.filter((e) => categoryLabel(e.category) === label);
    const r = byCat.getRow(rowNo);
    r.getCell(1).value = label;
    (
      [
        ['H', esum((e) => e.amountExGstCents, inCat)],
        ['I', esum((e) => e.gstCents, inCat)],
        ['J', esum((e) => e.totalCents, inCat)],
      ] as const
    ).forEach(([col, result], k) => {
      r.getCell(2 + k).value = {
        formula: `SUMIF(${catRange},$A${rowNo},${dataRange(col, eFirst, eLast, 'Expenses', true)})`,
        result,
      };
    });
  });
  const cLast = 1 + cats.length;
  const cTot = byCat.getRow(cLast + 1);
  cTot.getCell(1).value = 'Total';
  [2, 3, 4].forEach((col, k) => {
    cTot.getCell(col).value = { formula: sumFormula(colLetter(col), 2, cLast), result: eTotals[k]! };
  });
  styleTotalsRow(cTot, STOCK_CATEGORY_COLUMNS.length);

  // ---- Overview (formulas over the other sheets) ----
  const rng = (col: string) => dataRange(col, sFirst, sLast, 'Stock Summary', true);
  const fromX = excelDateExpr(data.from);
  const toX = excelDateExpr(data.to);
  const inPeriod = (col: string) => `${rng(col)},">="&${fromX},${rng(col)},"<="&${toX}`;
  const inKey = (d: Date | null | undefined) => {
    if (!d) return false;
    const k = excelDate(d, tz)!.toISOString().slice(0, 10);
    return k >= data.from && k <= data.to;
  };
  const purchasedN = rows.filter((r) => inKey(r.financials?.purchaseDate)).length;
  const soldRows = rows.filter((r) => r.sale && inKey(r.sale.saleDate));
  const soldGross = soldRows.map((r) => {
    const sale = dollars(r.sale!.salePriceCents)!;
    const gross = sale - dollars(r.financials?.purchasePriceCents ?? 0)! - dollars(r.expensesExGstCents)!;
    return { sale, gross, days: daysBetween(r.financials?.purchaseDate ?? r.car.createdAt ?? r.sale!.saleDate, r.sale!.saleDate) };
  });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : '');
  const ov: [string, ExcelJS.CellValue, string | undefined][] = [
    ['Period', period, undefined],
    ['Cars purchased', { formula: `COUNTIFS(${inPeriod('F')})`, result: purchasedN }, INT_FMT],
    ['Cars sold', { formula: `COUNT(${dataRange('C', slFirst, slLast, 'Sales', true)})`, result: saleRows.length }, INT_FMT],
    ['Revenue ex GST', { formula: sumFormula('E', slFirst, slLast, 'Sales'), result: slTotals[0]! }, MONEY_FMT],
    ['Expenses ex GST', { formula: sumFormula('H', eFirst, eLast, 'Expenses'), result: eTotals[0]! }, MONEY_FMT],
    [
      'Gross profit',
      { formula: `SUMIFS(${rng('L')},${inPeriod('K')})`, result: round2(soldGross.reduce((a, g) => a + g.gross, 0)) },
      MONEY_FMT,
    ],
    [
      'Average margin %',
      {
        formula: `IFERROR(AVERAGEIFS(${rng('M')},${inPeriod('K')}),"")`,
        result: avg(soldGross.filter((g) => g.sale !== 0).map((g) => g.gross / g.sale)),
      },
      PCT_FMT,
    ],
    [
      'Average days to sell',
      { formula: `IFERROR(AVERAGEIFS(${rng('N')},${inPeriod('K')}),"")`, result: avg(soldGross.map((g) => g.days)) },
      '0.0',
    ],
  ];
  ov.forEach(([label, value, fmt], i) => {
    const r = overview.getRow(2 + i);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true };
    const cell = r.getCell(2);
    cell.value = value;
    if (fmt) cell.numFmt = fmt;
    cell.alignment = { horizontal: 'right' };
  });
  overview.getRow(2 + ov.length + 1).getCell(1).value = `Generated ${formatDateAU(now, tz)}`;
  overview.getRow(2 + ov.length + 1).getCell(1).font = { italic: true, color: { argb: 'FF6B6E75' } };

  for (const ws of [overview, stock, exp, sales, byCat]) fitColumns(ws);
  return wb;
}
