/**
 * `@sda/shared/reports` – Excel (exceljs) + CSV report builders shared by the export Cloud Functions and
 * the admin's client-side demo mode. NOT re-exported from the package root (keeps exceljs out of bundles
 * that don't need it).
 *
 *   import { buildCarReport, carReportDataFromSource, reportSourceFromDemo } from '@sda/shared/reports';
 *   const data = carReportDataFromSource(reportSourceFromDemo(buildDemoDataset()), carId, { businessName });
 *   const buf = await buildCarReport(data!).xlsx.writeBuffer();
 */
export * from './types';
export {
  buildCarReport,
  carReportFileName,
  CAR_REPORT_SHEETS,
  CAR_REPORT_EXPENSE_COLUMNS,
  CAR_REPORT_CATEGORY_COLUMNS,
  CAR_REPORT_SUMMARY_LABELS,
} from './car-report';
export {
  buildStockReport,
  stockReportFileName,
  stockReportPeriodLabel,
  STOCK_REPORT_SHEETS,
  STOCK_SUMMARY_COLUMNS,
  STOCK_EXPENSE_COLUMNS,
  STOCK_SALES_COLUMNS,
  STOCK_CATEGORY_COLUMNS,
  STOCK_OVERVIEW_LABELS,
} from './stock-report';
export { stockSummaryCsv, expensesCsv, toCsv, csvField, type CsvOptions } from './csv';
export {
  carReportDataFromSource,
  stockReportDataFromSource,
  reportSourceFromDemo,
  plainDates,
  type ReportSource,
  type SourceExpense,
  type SourceSale,
  type StockReportQuery,
} from './source';
export { receiptLink, MONEY_FMT, DATE_FMT, PCT_FMT, type ColumnDef } from './sheet';

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
