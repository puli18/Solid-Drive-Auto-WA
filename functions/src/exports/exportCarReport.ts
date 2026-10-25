import { buildCarReport, carReportDataFromSource, carReportFileName, XLSX_CONTENT_TYPE } from '@sda/shared/reports';
import { defineCallable, HttpsError, writeAudit } from '../core';
import { loadCarSource, reportContext, saveExport } from './load';

/** exportCarReport (admin) – Car Report .xlsx (Summary, Expenses, By Category) → exports/{uid}/, 15-min URL. */
export const exportCarReport = defineCallable(
  'exportCarReport',
  async (input, ctx) => {
    const [src, rctx] = await Promise.all([loadCarSource(input.carId), reportContext()]);
    const data = carReportDataFromSource(src, input.carId, rctx);
    if (!data) throw new HttpsError('not-found', 'Car not found');
    const buf = Buffer.from(await buildCarReport(data).xlsx.writeBuffer());
    const fileName = carReportFileName(data.car);
    const out = await saveExport(ctx.uid!, fileName, buf, XLSX_CONTENT_TYPE);
    await writeAudit({ actorUid: ctx.uid!, action: 'export', entity: 'export', entityId: out.path, carId: input.carId, after: { report: 'car', fileName } });
    return { url: out.url, fileName: out.fileName, expiresAt: out.expiresAt };
  },
  { memory: '512MiB', timeoutSeconds: 120 },
);
