import {
  buildStockReport,
  CSV_CONTENT_TYPE,
  expensesCsv,
  stockReportDataFromSource,
  stockReportFileName,
  stockSummaryCsv,
  XLSX_CONTENT_TYPE,
} from '@sda/shared/reports';
import { defineCallable, writeAudit } from '../core';
import { loadAllSource, reportContext, saveExport } from './load';

/**
 * exportStockReport (admin) – Stock & Sales Report for {from, to, status?, category?}:
 * format "xlsx" (Overview, Stock Summary, Expenses, Sales, By Category) or CSV ("csv-stock" / "csv-expenses").
 */
export const exportStockReport = defineCallable(
  'exportStockReport',
  async (input, ctx) => {
    const [src, rctx] = await Promise.all([loadAllSource(), reportContext()]);
    const data = stockReportDataFromSource(src, input, rctx);
    let file: { name: string; body: Buffer | string; type: string };
    if (input.format === 'csv-stock') {
      file = { name: stockReportFileName(input.from, input.to, 'csv', 'StockSummary'), body: stockSummaryCsv(data, { bom: true }), type: CSV_CONTENT_TYPE };
    } else if (input.format === 'csv-expenses') {
      file = { name: stockReportFileName(input.from, input.to, 'csv', 'Expenses'), body: expensesCsv(data, { bom: true }), type: CSV_CONTENT_TYPE };
    } else {
      file = {
        name: stockReportFileName(input.from, input.to),
        body: Buffer.from(await buildStockReport(data).xlsx.writeBuffer()),
        type: XLSX_CONTENT_TYPE,
      };
    }
    const out = await saveExport(ctx.uid!, file.name, file.body, file.type);
    await writeAudit({
      actorUid: ctx.uid!,
      action: 'export',
      entity: 'export',
      entityId: out.path,
      after: { report: 'stock', format: input.format, from: input.from, to: input.to, status: input.status ?? null, category: input.category ?? null },
    });
    return { url: out.url, fileName: out.fileName, expiresAt: out.expiresAt };
  },
  { memory: '1GiB', timeoutSeconds: 300 },
);
