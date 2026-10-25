import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '../src/demo';
import {
  buildCarReport,
  buildStockReport,
  CAR_REPORT_CATEGORY_COLUMNS,
  CAR_REPORT_EXPENSE_COLUMNS,
  CAR_REPORT_SHEETS,
  CAR_REPORT_SUMMARY_LABELS,
  carReportDataFromSource,
  carReportFileName,
  expensesCsv,
  reportSourceFromDemo,
  STOCK_CATEGORY_COLUMNS,
  STOCK_EXPENSE_COLUMNS,
  STOCK_OVERVIEW_LABELS,
  STOCK_REPORT_SHEETS,
  STOCK_SALES_COLUMNS,
  STOCK_SUMMARY_COLUMNS,
  stockReportDataFromSource,
  stockReportFileName,
  stockSummaryCsv,
} from '../src/reports';
import { addDaysToDateKey, todayInTz } from '../src/time';

const NOW = new Date('2026-10-25T02:00:00Z');
const ds = buildDemoDataset({ now: NOW });
const src = reportSourceFromDemo(ds);
const ctx = { businessName: 'Solid Drive Auto WA', siteUrl: 'https://example.test', generatedAt: NOW };
const today = todayInTz('Australia/Perth', NOW);
const from = addDaysToDateKey(today, -90);

/** Write → read back, so we test the real .xlsx file. */
async function roundTrip(wb: ExcelJS.Workbook) {
  const buf = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buf as ArrayBuffer);
  return back;
}
const headers = (ws: ExcelJS.Worksheet) => (ws.getRow(1).values as unknown[]).slice(1);
const lastRow = (ws: ExcelJS.Worksheet) => ws.getRow(ws.actualRowCount);
const formulaOf = (cell: ExcelJS.Cell) => (cell.value as ExcelJS.CellFormulaValue | null)?.formula;

describe('car report', () => {
  const sold = ds.cars.find((c) => c.status === 'sold')!;
  const data = carReportDataFromSource(src, sold.id, ctx)!;

  it('has the planned sheets, headers and formula totals', async () => {
    expect(data.expenses.length).toBeGreaterThan(0);
    expect(data.sale).not.toBeNull();
    const wb = await roundTrip(buildCarReport(data));
    expect(wb.worksheets.map((w) => w.name)).toEqual([...CAR_REPORT_SHEETS]);

    const summary = wb.getWorksheet('Summary')!;
    const labels = Array.from({ length: CAR_REPORT_SUMMARY_LABELS.length }, (_, i) => summary.getCell(`A${i + 2}`).value);
    expect(labels).toEqual([...CAR_REPORT_SUMMARY_LABELS]);
    expect(formulaOf(summary.getCell('B10'))).toMatch(/^SUM\(Expenses!F2:F\d+\)$/);
    expect(formulaOf(summary.getCell('B12'))).toBe('B9+B10');
    expect(formulaOf(summary.getCell('B15'))).toBe('IF(B14="","",B14-B12)');
    expect(formulaOf(summary.getCell('B16'))).toBe('IF(OR(B14="",B14=0),"",B15/B14)');

    const exp = wb.getWorksheet('Expenses')!;
    expect(headers(exp)).toEqual(CAR_REPORT_EXPENSE_COLUMNS.map((c) => c.header));
    const tot = lastRow(exp);
    expect(tot.getCell(1).value).toBe('Total');
    const n = data.expenses.length + 1;
    expect(formulaOf(tot.getCell(6))).toBe(`SUM(F2:F${n})`);
    expect(formulaOf(tot.getCell(8))).toBe(`SUM(H2:H${n})`);
    const exGst = data.expenses.reduce((s, e) => s + e.amountExGstCents, 0) / 100;
    expect((tot.getCell(6).value as ExcelJS.CellFormulaValue).result).toBeCloseTo(exGst, 2);
    expect(exp.getColumn(6).numFmt).toBe('$#,##0.00');
    expect(exp.getColumn(1).numFmt).toBe('dd/mm/yyyy');
    expect(exp.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(exp.autoFilter).toBeTruthy();
    expect(exp.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(exp.headerFooter.oddHeader).toContain('Solid Drive Auto WA');

    const byCat = wb.getWorksheet('By Category')!;
    expect(headers(byCat)).toEqual(CAR_REPORT_CATEGORY_COLUMNS.map((c) => c.header));
    expect(formulaOf(byCat.getCell('B2'))).toMatch(/^SUMIF\(Expenses!\$B\$2:\$B\$\d+,\$A2,Expenses!\$F\$2:\$F\$\d+\)$/);
    expect(formulaOf(lastRow(byCat).getCell(2))).toMatch(/^SUM\(B2:B\d+\)$/);

    // Gross profit result = sale − purchase − expenses (ex GST)
    const fin = data.financials!;
    const gp = (data.sale!.salePriceCents - fin.purchasePriceCents) / 100 - exGst;
    expect((summary.getCell('B15').value as ExcelJS.CellFormulaValue).result).toBeCloseTo(gp, 2);
  });

  it('writes calendar dates in the dealership zone (no UTC day shift)', async () => {
    const wb = await roundTrip(buildCarReport(data));
    const d = wb.getWorksheet('Summary')!.getCell('B8').value as Date;
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth' }).format(data.financials!.purchaseDate!);
    expect(d.toISOString().slice(0, 10)).toBe(expected);
  });

  it('links receipts to the admin viewer, never a signed URL', async () => {
    const withReceipt = {
      ...data,
      expenses: data.expenses.map((e, i) => (i === 0 ? { ...e, receiptPath: `receipts/${sold.id}/${e.id}/inv 1.pdf` } : e)),
    };
    const wb = await roundTrip(buildCarReport(withReceipt));
    const links = wb
      .getWorksheet('Expenses')!
      .getColumn(9)
      .values.filter((v): v is ExcelJS.CellHyperlinkValue => !!v && typeof v === 'object' && 'hyperlink' in v);
    expect(links).toHaveLength(1);
    expect(links[0]!.hyperlink).toBe(
      `https://example.test/admin/receipts/receipts/${sold.id}/${data.expenses[0]!.id}/inv%201.pdf`,
    );
  });

  it('names the file per the plan', () => {
    expect(carReportFileName({ stockNo: 'SDA1001', year: 2021, make: 'Toyota', model: 'Hilux' })).toBe(
      'CarReport_SDA1001_2021-Toyota-Hilux.xlsx',
    );
  });
});

describe('stock & sales report', () => {
  const data = stockReportDataFromSource(src, { from, to: today }, ctx);

  it('has the planned sheets, headers and formula totals', async () => {
    expect(data.stock.length).toBeGreaterThan(10);
    expect(data.sales.length).toBe(1);
    const wb = await roundTrip(buildStockReport(data));
    expect(wb.worksheets.map((w) => w.name)).toEqual([...STOCK_REPORT_SHEETS]);

    const ov = wb.getWorksheet('Overview')!;
    expect(Array.from({ length: STOCK_OVERVIEW_LABELS.length }, (_, i) => ov.getCell(`A${i + 2}`).value)).toEqual([
      ...STOCK_OVERVIEW_LABELS,
    ]);
    for (let r = 3; r <= 9; r++) expect(formulaOf(ov.getCell(`B${r}`))).toBeTruthy();

    const checks: [string, string[], string[]][] = [
      ['Stock Summary', STOCK_SUMMARY_COLUMNS.map((c) => c.header), ['G', 'H', 'I', 'J', 'L']],
      ['Expenses', STOCK_EXPENSE_COLUMNS.map((c) => c.header), ['H', 'I', 'J']],
      ['Sales', STOCK_SALES_COLUMNS.map((c) => c.header), ['E', 'F', 'G', 'H']],
      ['By Category', STOCK_CATEGORY_COLUMNS.map((c) => c.header), ['B', 'C', 'D']],
    ];
    for (const [name, hdrs, totalCols] of checks) {
      const ws = wb.getWorksheet(name)!;
      expect(headers(ws)).toEqual(hdrs);
      const tot = lastRow(ws);
      expect(tot.getCell(1).value).toBe('Total');
      for (const col of totalCols) expect(formulaOf(tot.getCell(col))).toMatch(/^SUM\(/);
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    }

    const ss = wb.getWorksheet('Stock Summary')!;
    expect(formulaOf(ss.getCell('L2'))).toBe('IF(J2="","",J2-G2-H2)');
    expect(formulaOf(ss.getCell('M2'))).toBe('IF(OR(J2="",J2=0),"",L2/J2)');
    expect(formulaOf(wb.getWorksheet('By Category')!.getCell('B2'))).toMatch(/^SUMIF\(Expenses!\$D\$2/);
  });

  it('exports CSV for Stock Summary and Expenses', () => {
    const s = stockSummaryCsv(data).split('\r\n');
    expect(s[0]).toBe(STOCK_SUMMARY_COLUMNS.map((c) => c.header).join(','));
    expect(s.length).toBe(data.stock.length + 2); // header + rows + trailing empty
    const e = expensesCsv(data).split('\r\n');
    expect(e[0]).toBe(STOCK_EXPENSE_COLUMNS.map((c) => c.header).join(','));
    expect(e.length).toBe(data.expenses.length + 2);
  });

  it('applies status and category filters', () => {
    const avail = stockReportDataFromSource(src, { from, to: today, status: 'available' }, ctx);
    expect(avail.stock.every((r) => r.car.status === 'available')).toBe(true);
    const tyres = stockReportDataFromSource(src, { from, to: today, category: 'tyres' }, ctx);
    expect(tyres.expenses.every((e) => e.category === 'tyres')).toBe(true);
  });

  it('builds a valid workbook with no rows', async () => {
    const empty = stockReportDataFromSource(src, { from: '2001-01-01', to: '2001-01-31' }, ctx);
    expect(empty.stock).toHaveLength(0);
    const wb = await roundTrip(buildStockReport(empty));
    expect(formulaOf(lastRow(wb.getWorksheet('Expenses')!).getCell('H'))).toBe('SUM(H1:H1)');
  });

  it('names the file per the plan', () => {
    expect(stockReportFileName('2026-07-01', '2026-09-30')).toBe('StockReport_2026-07-01_to_2026-09-30.xlsx');
  });
});
