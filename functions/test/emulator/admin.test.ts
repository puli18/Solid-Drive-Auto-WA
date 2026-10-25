import { addDaysToDateKey, buildDemoDataset, todayInTz, type DemoDoc } from '@sda/shared';
import { CAR_REPORT_SHEETS, STOCK_REPORT_SHEETS } from '@sda/shared/reports';
import ExcelJS from 'exceljs';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it } from 'vitest';
import { auth, db } from '../../src/core/admin';
import { exportCarReport } from '../../src/exports/exportCarReport';
import { exportStockReport } from '../../src/exports/exportStockReport';
import { inviteUser } from '../../src/users/inviteUser';
import { setUserRole } from '../../src/users/setUserRole';
import { deactivateUser } from '../../src/users/deactivateUser';
import { loadFeedItems, feedToXml } from '../../src/feed/stockFeed';
import { callReq, resetAuth, resetFirestore } from './helpers';

const ADMIN = { uid: 'demo-admin', role: 'admin' as const };
const STAFF = { uid: 'demo-staff', role: 'staff' as const };

function toFs(v: unknown): unknown {
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (Array.isArray(v)) return v.map(toFs);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)]));
  return v;
}
async function write(path: (d: DemoDoc) => string, docs: DemoDoc[]) {
  const batch = db.batch();
  for (const d of docs) {
    const { id: _id, ...rest } = d;
    batch.set(db.doc(path(d)), toFs(rest) as Record<string, unknown>);
  }
  await batch.commit();
}

const ds = buildDemoDataset();
beforeAll(async () => {
  await resetFirestore();
  await resetAuth();
  for (const [id, data] of Object.entries(ds.settings)) await db.doc(`settings/${id}`).set(toFs(data) as Record<string, unknown>);
  for (const col of ['users', 'cars', 'carFinancials', 'sales', 'deposits'] as const) await write((d) => `${col}/${d.id}`, ds[col]);
  await write((d) => `cars/${String(d.carId)}/expenses/${d.id}`, ds.expenses);
});

async function download(url: string) {
  const res = await fetch(url);
  expect(res.ok).toBe(true);
  return Buffer.from(await res.arrayBuffer());
}

describe('exports', () => {
  const sold = ds.cars.find((c) => c.status === 'sold')!;

  it('staff calling an export get permission-denied', async () => {
    await expect(exportCarReport.run(callReq({ carId: sold.id }, STAFF))).rejects.toMatchObject({ code: 'permission-denied' });
    const today = todayInTz('Australia/Perth');
    await expect(exportStockReport.run(callReq({ from: today, to: today }, STAFF))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(exportCarReport.run(callReq({ carId: sold.id }))).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('admin car report: saved to exports/{uid}/, downloadable, planned sheets + formula totals', async () => {
    const r = await exportCarReport.run(callReq({ carId: sold.id }, ADMIN));
    expect(r.fileName).toMatch(/^CarReport_SDA\d+_\d{4}-[A-Za-z-]+\.xlsx$/);
    expect(new Date(r.expiresAt).getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(decodeURIComponent(r.url)).toContain(`exports/${ADMIN.uid}/`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await download(r.url)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...CAR_REPORT_SHEETS]);
    const exp = wb.getWorksheet('Expenses')!;
    const tot = exp.getRow(exp.actualRowCount);
    expect(tot.getCell(1).value).toBe('Total');
    expect((tot.getCell(6).value as ExcelJS.CellFormulaValue).formula).toMatch(/^SUM\(F2:F\d+\)$/);
    expect((wb.getWorksheet('Summary')!.getCell('B15').value as ExcelJS.CellFormulaValue).formula).toBe('IF(B14="","",B14-B12)');
  });

  it('admin stock report xlsx + CSV', async () => {
    const to = todayInTz('Australia/Perth');
    const from = addDaysToDateKey(to, -90);
    const x = await exportStockReport.run(callReq({ from, to }, ADMIN));
    expect(x.fileName).toBe(`StockReport_${from}_to_${to}.xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await download(x.url)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...STOCK_REPORT_SHEETS]);
    const ss = wb.getWorksheet('Stock Summary')!;
    expect(ss.actualRowCount).toBeGreaterThan(10);
    expect((ss.getRow(ss.actualRowCount).getCell('L').value as ExcelJS.CellFormulaValue).formula).toMatch(/^SUM\(L2:L\d+\)$/);
    const csv = await exportStockReport.run(callReq({ from, to, format: 'csv-expenses' }, ADMIN));
    expect(csv.fileName).toBe(`StockReport_${from}_to_${to}_Expenses.csv`);
    expect((await download(csv.url)).toString('utf8')).toContain('Stock no,Car,Date,Category');
  });
});

describe('users', () => {
  it('invite → role change → deactivate (claims, users doc, tokens revoked)', async () => {
    const inv = await inviteUser.run(callReq({ email: 'new.staff@example.com', name: 'New Staff', role: 'staff' }, ADMIN));
    expect(inv.resetLink).toBeTruthy();
    expect((await auth.getUser(inv.uid)).customClaims).toEqual({ role: 'staff' });
    expect((await db.doc(`users/${inv.uid}`).get()).data()).toMatchObject({ role: 'staff', active: true });
    await expect(inviteUser.run(callReq({ email: 'new.staff@example.com', name: 'Dup', role: 'staff' }, ADMIN))).rejects.toMatchObject({
      code: 'already-exists',
    });

    await setUserRole.run(callReq({ uid: inv.uid, role: 'admin' }, ADMIN));
    expect((await auth.getUser(inv.uid)).customClaims).toEqual({ role: 'admin' });

    await deactivateUser.run(callReq({ uid: inv.uid }, ADMIN));
    const u = await auth.getUser(inv.uid);
    expect(u.customClaims?.role).toBeUndefined();
    expect(u.disabled).toBe(true);
    expect(u.tokensValidAfterTime).toBeTruthy();
    expect((await db.doc(`users/${inv.uid}`).get()).data()).toMatchObject({ active: false });

    await expect(deactivateUser.run(callReq({ uid: ADMIN.uid }, ADMIN))).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(setUserRole.run(callReq({ uid: inv.uid, role: 'staff' }, STAFF))).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('stockFeed (M8)', () => {
  it('only published + available + toggled cars; a sold car disappears on the next request', async () => {
    const items = await loadFeedItems();
    const ids = new Set(items.map((i) => i.id));
    for (const c of ds.cars) {
      const s = c.syndication as Record<string, boolean>;
      const expected = c.published === true && c.status === 'available' && Object.values(s).some(Boolean);
      expect(ids.has(c.id)).toBe(expected);
    }
    const victim = items[0]!;
    await db.doc(`cars/${victim.id}`).update({ status: 'sold' });
    expect((await loadFeedItems()).some((i) => i.id === victim.id)).toBe(false);
    expect(feedToXml(items, new Date())).toContain('<stockFeed');
    const fb = await loadFeedItems('facebook');
    expect(fb.every((i) => i.channels.includes('facebook'))).toBe(true);
  });
});
