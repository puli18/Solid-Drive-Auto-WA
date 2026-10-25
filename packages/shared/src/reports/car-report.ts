/**
 * Car Report – `CarReport_{stockNo}_{year}-{make}-{model}.xlsx`
 * Sheets: Summary (label/value with formulas), Expenses (+ SUM totals), By Category (SUMIF against Expenses).
 */
import type ExcelJS from 'exceljs';
import { carTitle } from '../slug';
import { daysBetween, formatDateAU } from '../time';
import {
  addSheet,
  categoryLabel,
  colLetter,
  dataRange,
  DATE_FMT,
  dollars,
  excelDate,
  fitColumns,
  INT_FMT,
  MONEY_FMT,
  newWorkbook,
  PCT_FMT,
  receiptLink,
  round2,
  statusLabel,
  styleTotalsRow,
  sumFormula,
  tzOf,
  type ColumnDef,
} from './sheet';
import type { CarReportData } from './types';

export const CAR_REPORT_SHEETS = ['Summary', 'Expenses', 'By Category'] as const;

export const CAR_REPORT_EXPENSE_COLUMNS: ColumnDef[] = [
  { header: 'Date', kind: 'date' },
  { header: 'Category', kind: 'text' },
  { header: 'Description', kind: 'text' },
  { header: 'Vendor', kind: 'text' },
  { header: 'Invoice no', kind: 'text' },
  { header: 'Amount ex GST', kind: 'money' },
  { header: 'GST', kind: 'money' },
  { header: 'Total inc GST', kind: 'money' },
  { header: 'Receipt', kind: 'link' },
  { header: 'Logged by', kind: 'text' },
];
export const CAR_REPORT_CATEGORY_COLUMNS: ColumnDef[] = [
  { header: 'Category', kind: 'text' },
  { header: 'Amount ex GST', kind: 'money' },
  { header: 'GST', kind: 'money' },
  { header: 'Total inc GST', kind: 'money' },
];
export const CAR_REPORT_SUMMARY_LABELS = [
  'Stock no',
  'VIN',
  'Rego',
  'Car',
  'Km',
  'Status',
  'Purchase date',
  'Purchase price ex GST',
  'Total expenses ex GST',
  'GST on expenses',
  'Total cost',
  'Sale date',
  'Sale price ex GST',
  'Gross profit',
  'Margin %',
  'Days in stock',
] as const;

function fileSafe(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `CarReport_SDA1001_2021-Toyota-Hilux.xlsx` */
export function carReportFileName(car: { stockNo: string; year: number; make: string; model: string }): string {
  return `CarReport_${fileSafe(car.stockNo)}_${car.year}-${fileSafe(car.make)}-${fileSafe(car.model)}.xlsx`;
}

export function buildCarReport(data: CarReportData): ExcelJS.Workbook {
  const tz = tzOf(data);
  const now = data.generatedAt ?? new Date();
  const { car, financials, sale } = data;
  const expenses = [...data.expenses].sort((a, b) => a.date.getTime() - b.date.getTime());
  const title = carTitle(car);

  const stockStart = financials?.purchaseDate ?? car.createdAt ?? null;
  const stockEnd = sale?.saleDate ?? car.soldAt ?? null;
  const periodLabel = `${car.stockNo} · ${stockStart ? formatDateAU(stockStart, tz) : '—'} – ${formatDateAU(stockEnd ?? now, tz)}`;

  const wb = newWorkbook(data, `Car Report ${car.stockNo}`);

  // Sheets are created in order so the tab order is Summary, Expenses, By Category.
  const summary = addSheet(
    wb,
    'Summary',
    [
      { header: 'Item', kind: 'text' },
      { header: 'Value', kind: 'text' },
    ],
    data,
    periodLabel,
  );
  const exp = addSheet(wb, 'Expenses', CAR_REPORT_EXPENSE_COLUMNS, data, periodLabel);
  const byCat = addSheet(wb, 'By Category', CAR_REPORT_CATEGORY_COLUMNS, data, periodLabel);

  // ---- Expenses ----
  const first = 2;
  expenses.forEach((e, i) => {
    const r = exp.getRow(first + i);
    r.values = [
      excelDate(e.date, tz),
      categoryLabel(e.category),
      e.description,
      e.vendorName,
      e.invoiceNo,
      dollars(e.amountExGstCents),
      dollars(e.gstCents),
      dollars(e.totalCents),
      e.receiptPath ? { text: 'View receipt', hyperlink: receiptLink(data.siteUrl, e.receiptPath) } : '',
      e.loggedBy,
    ];
    if (e.receiptPath) r.getCell(9).font = { color: { argb: 'FFD7261E' }, underline: true };
  });
  const last = first + expenses.length - 1;
  const totalRowNo = last + 1;
  const sum = (cents: (e: (typeof expenses)[number]) => number) => round2(expenses.reduce((s, e) => s + cents(e), 0) / 100);
  const totExGst = sum((e) => e.amountExGstCents);
  const totGst = sum((e) => e.gstCents);
  const totInc = sum((e) => e.totalCents);
  const expTotals = exp.getRow(totalRowNo);
  expTotals.getCell(1).value = 'Total';
  expTotals.getCell(6).value = { formula: sumFormula('F', first, last), result: totExGst };
  expTotals.getCell(7).value = { formula: sumFormula('G', first, last), result: totGst };
  expTotals.getCell(8).value = { formula: sumFormula('H', first, last), result: totInc };
  styleTotalsRow(expTotals, CAR_REPORT_EXPENSE_COLUMNS.length);

  // ---- By Category (SUMIF against Expenses) ----
  const cats = [...new Set(expenses.map((e) => categoryLabel(e.category)))].sort();
  const catRange = dataRange('B', first, last, 'Expenses', true);
  cats.forEach((label, i) => {
    const rowNo = 2 + i;
    const r = byCat.getRow(rowNo);
    const inCat = expenses.filter((e) => categoryLabel(e.category) === label);
    const s = (f: (e: (typeof expenses)[number]) => number) => round2(inCat.reduce((a, e) => a + f(e), 0) / 100);
    r.getCell(1).value = label;
    (
      [
        ['F', 2, s((e) => e.amountExGstCents)],
        ['G', 3, s((e) => e.gstCents)],
        ['H', 4, s((e) => e.totalCents)],
      ] as const
    ).forEach(([col, c, result]) => {
      r.getCell(c).value = {
        formula: `SUMIF(${catRange},$A${rowNo},${dataRange(col, first, last, 'Expenses', true)})`,
        result,
      };
    });
  });
  const catLast = 1 + cats.length;
  const catTotals = byCat.getRow(catLast + 1);
  catTotals.getCell(1).value = 'Total';
  [2, 3, 4].forEach((c, k) => {
    catTotals.getCell(c).value = { formula: sumFormula(colLetter(c), 2, catLast), result: [totExGst, totGst, totInc][k]! };
  });
  styleTotalsRow(catTotals, CAR_REPORT_CATEGORY_COLUMNS.length);

  // ---- Summary ----
  const purchase = financials ? dollars(financials.purchasePriceCents)! : 0;
  const totalCost = round2(purchase + totExGst);
  const salePrice = sale ? dollars(sale.salePriceCents)! : null;
  const gross = salePrice == null ? '' : round2(salePrice - totalCost);
  const margin = salePrice == null || salePrice === 0 || gross === '' ? '' : (gross as number) / salePrice;
  const days = stockStart ? daysBetween(stockStart, stockEnd ?? now) : null;

  type V = ExcelJS.CellValue;
  const rows: [string, V, string | undefined][] = [
    ['Stock no', car.stockNo, undefined],
    ['VIN', car.vin ?? '', undefined],
    ['Rego', car.rego ?? '', undefined],
    ['Car', title, undefined],
    ['Km', car.km, INT_FMT],
    ['Status', statusLabel(String(car.status)), undefined],
    ['Purchase date', excelDate(financials?.purchaseDate ?? null, tz) ?? '', DATE_FMT],
    ['Purchase price ex GST', purchase, MONEY_FMT],
    ['Total expenses ex GST', { formula: sumFormula('F', first, last, 'Expenses'), result: totExGst }, MONEY_FMT],
    ['GST on expenses', { formula: sumFormula('G', first, last, 'Expenses'), result: totGst }, MONEY_FMT],
    ['Total cost', { formula: 'B9+B10', result: totalCost }, MONEY_FMT],
    ['Sale date', excelDate(sale?.saleDate ?? null, tz) ?? '', DATE_FMT],
    ['Sale price ex GST', salePrice ?? '', MONEY_FMT],
    ['Gross profit', { formula: 'IF(B14="","",B14-B12)', result: gross }, MONEY_FMT],
    ['Margin %', { formula: 'IF(OR(B14="",B14=0),"",B15/B14)', result: margin }, PCT_FMT],
    ['Days in stock', days ?? '', INT_FMT],
  ];
  rows.forEach(([label, value, fmt], i) => {
    const r = summary.getRow(2 + i);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true };
    const cell = r.getCell(2);
    cell.value = value;
    if (fmt) cell.numFmt = fmt;
    cell.alignment = { horizontal: 'right' };
  });

  for (const ws of [summary, exp, byCat]) fitColumns(ws);
  return wb;
}
