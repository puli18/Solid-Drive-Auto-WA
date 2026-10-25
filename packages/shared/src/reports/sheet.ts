/** Shared exceljs formatting helpers: header styling, formats, widths, header/footer. */
import ExcelJS from 'exceljs';
import { DEFAULT_TIMEZONE, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, CAR_STATUS_LABELS } from '../constants';
import { dateKeyInTz, formatDateAU } from '../time';
import type { ReportContext } from './types';

export const MONEY_FMT = '$#,##0.00';
export const DATE_FMT = 'dd/mm/yyyy';
export const PCT_FMT = '0.00%';
export const INT_FMT = '#,##0';

/** Header fill: SDA graphite with white bold text. */
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17181B' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } };

export type ColumnKind = 'text' | 'money' | 'date' | 'pct' | 'int' | 'link';
export interface ColumnDef {
  header: string;
  kind: ColumnKind;
}

export const tzOf = (ctx: ReportContext) => ctx.timezone ?? DEFAULT_TIMEZONE;

/**
 * Excel stores dates without a zone: write the CALENDAR date in the dealership zone as UTC midnight,
 * so a Perth-midnight timestamp doesn't show as the previous day.
 */
export function excelDate(d: Date | null | undefined, tz: string): Date | null {
  if (!d) return null;
  return new Date(`${dateKeyInTz(d, tz)}T00:00:00Z`);
}

/** Date-key ("YYYY-MM-DD") → Excel DATE(y,m,d) expression for formulas. */
export function excelDateExpr(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `DATE(${y},${m},${d})`;
}

export const dollars = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

export const categoryLabel = (c: string) => EXPENSE_CATEGORY_LABELS[c as keyof typeof EXPENSE_CATEGORY_LABELS] ?? c;
export const paymentLabel = (p: string) => PAYMENT_METHOD_LABELS[p as keyof typeof PAYMENT_METHOD_LABELS] ?? p;
export const statusLabel = (s: string) => CAR_STATUS_LABELS[s as keyof typeof CAR_STATUS_LABELS] ?? s;

/** Absolute (or relative) admin receipt-viewer link. Never a raw signed URL. */
export function receiptLink(siteUrl: string | undefined, path: string): string {
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `${(siteUrl ?? '').replace(/\/$/, '')}/admin/receipts/${encoded}`;
}

export function newWorkbook(ctx: ReportContext, title: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.businessName;
  wb.company = ctx.businessName;
  wb.title = title;
  const now = ctx.generatedAt ?? new Date();
  wb.created = now;
  wb.modified = now;
  // Ask Excel / Sheets to recalculate every formula on open (cached results are also written).
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

/** Escape "&" for header/footer codes. */
const hf = (s: string) => s.replace(/&/g, '&&');

/** Creates a sheet with the styled, frozen, filtered header row and the business/period header + footer. */
export function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: ColumnDef[],
  ctx: ReportContext,
  periodLabel: string,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const generated = formatDateAU(ctx.generatedAt ?? new Date(), tzOf(ctx));
  ws.headerFooter = {
    oddHeader: `&L&B${hf(ctx.businessName)}&C${hf(name)}&R${hf(periodLabel)}`,
    oddFooter: `&L${hf(ctx.businessName)} – ${hf(periodLabel)}&CGenerated ${generated}&RPage &P of &N`,
  };
  const header = ws.getRow(1);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle' };
    const col = ws.getColumn(i + 1);
    const fmt = numFmtFor(c.kind);
    if (fmt) col.numFmt = fmt;
  });
  header.height = 20;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

export function numFmtFor(kind: ColumnKind): string | undefined {
  switch (kind) {
    case 'money':
      return MONEY_FMT;
    case 'date':
      return DATE_FMT;
    case 'pct':
      return PCT_FMT;
    case 'int':
      return INT_FMT;
    default:
      return undefined;
  }
}

/** Style a totals row (bold, light fill, top border). */
export function styleTotalsRow(row: ExcelJS.Row, columnCount: number) {
  for (let c = 1; c <= columnCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true };
    cell.fill = TOTAL_FILL;
    cell.border = { top: { style: 'thin', color: { argb: 'FF17181B' } } };
  }
}

/** Width estimate per cell value (what Excel would display). */
function displayLength(value: ExcelJS.CellValue, numFmt: string): number {
  const v = value;
  if (v == null) return 0;
  if (v instanceof Date) return 10;
  if (typeof v === 'number') {
    if (numFmt.includes('$')) {
      return `$${v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.length + 1;
    }
    if (numFmt.includes('%')) return `${(v * 100).toFixed(2)}%`.length;
    return v.toLocaleString('en-AU').length;
  }
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text.length;
    if ('formula' in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      if (typeof r === 'number' || r instanceof Date) return displayLength(r, numFmt);
      return String(r ?? '').length || 10;
    }
  }
  return String(v).length;
}

/** Fit column widths to the content (min 8, max 60 characters). */
export function fitColumns(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const pad = Number(cell.row) === 1 ? 4 : 2;
      const len = displayLength(cell.value, cell.numFmt ?? '') + pad;
      if (len > max) max = len;
    });
    col.width = Math.min(60, max);
  });
}

/** A1 column letter for a 1-based index. */
export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Sheet reference usable in formulas: 'Stock Summary'!A1 */
export const sheetRef = (sheet: string) => (/^[A-Za-z0-9_]+$/.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`);

/**
 * A1 range for data rows; when there are no data rows it points at the (text) header row, so SUM/SUMIF
 * stay formulas that evaluate to 0 without referencing the totals row (no circular reference).
 */
export function dataRange(col: string, firstRow: number, lastRow: number, sheet?: string, absolute = false): string {
  const p = sheet ? `${sheetRef(sheet)}!` : '';
  const [a, b] = lastRow < firstRow ? [firstRow - 1, firstRow - 1] : [firstRow, lastRow];
  const c = absolute ? `$${col}$` : col;
  return `${p}${c}${a}:${c}${b}`;
}

/** "SUM(F2:F9)" – always a formula, even with no data rows. */
export function sumFormula(col: string, firstRow: number, lastRow: number, sheet?: string): string {
  return `SUM(${dataRange(col, firstRow, lastRow, sheet)})`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
