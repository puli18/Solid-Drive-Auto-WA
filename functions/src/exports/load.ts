/** Loads Firestore data for the report builders in @sda/shared/reports (Timestamps → Dates). */
import { COLLECTIONS, DEFAULT_TIMEZONE, EXPORT_URL_TTL_MINUTES, storagePaths } from '@sda/shared';
import { plainDates, type ReportContext, type ReportSource } from '@sda/shared/reports';
import type { QuerySnapshot } from 'firebase-admin/firestore';
import { db } from '../core/admin';
import { siteUrl } from '../core/config';
import { getBusinessSettings } from '../core/settings';
import { saveAndSign } from '../core/storage-url';

type Rows = Record<string, unknown>[];
const rows = (snap: QuerySnapshot): Rows => snap.docs.map((d) => ({ id: d.id, ...plainDates(d.data()) }));

export async function reportContext(): Promise<ReportContext> {
  const b = await getBusinessSettings();
  return { businessName: b.name, timezone: b.timezone || DEFAULT_TIMEZONE, siteUrl: siteUrl(), generatedAt: new Date() };
}

async function users(): Promise<ReportSource['users']> {
  const snap = await db.collection(COLLECTIONS.users).get();
  return snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? d.data().email ?? d.id) }));
}

export async function loadCarSource(carId: string): Promise<ReportSource> {
  const carRef = db.collection(COLLECTIONS.cars).doc(carId);
  const [car, fin, expenses, sales, us] = await Promise.all([
    carRef.get(),
    db.collection(COLLECTIONS.carFinancials).doc(carId).get(),
    carRef.collection(COLLECTIONS.expenses).get(),
    db.collection(COLLECTIONS.sales).where('carId', '==', carId).get(),
    users(),
  ]);
  const saleRows = rows(sales);
  const depositIds = saleRows.map((s) => s.depositId).filter((x): x is string => typeof x === 'string' && x.length > 0);
  const deposits = depositIds.length ? await db.getAll(...depositIds.map((id) => db.collection(COLLECTIONS.deposits).doc(id))) : [];
  return {
    cars: car.exists ? ([{ id: car.id, ...plainDates(car.data()!) }] as unknown as ReportSource['cars']) : [],
    carFinancials: fin.exists ? ([{ id: fin.id, ...plainDates(fin.data()!) }] as unknown as ReportSource['carFinancials']) : [],
    expenses: rows(expenses).map((e) => ({ ...e, carId: carId })) as unknown as ReportSource['expenses'],
    sales: saleRows as unknown as ReportSource['sales'],
    deposits: deposits.filter((d) => d.exists).map((d) => ({ id: d.id, amountCents: Number(d.data()!.amountCents) })),
    users: us,
  };
}

export async function loadAllSource(): Promise<ReportSource> {
  const [cars, fin, expenses, sales, deposits, us] = await Promise.all([
    db.collection(COLLECTIONS.cars).get(),
    db.collection(COLLECTIONS.carFinancials).get(),
    db.collectionGroup(COLLECTIONS.expenses).get(),
    db.collection(COLLECTIONS.sales).get(),
    db.collection(COLLECTIONS.deposits).get(),
    users(),
  ]);
  return {
    cars: rows(cars) as unknown as ReportSource['cars'],
    carFinancials: rows(fin) as unknown as ReportSource['carFinancials'],
    expenses: expenses.docs.map((d) => ({
      id: d.id,
      ...plainDates(d.data()),
      carId: (d.data().carId as string) || d.ref.parent.parent?.id || '',
    })) as unknown as ReportSource['expenses'],
    sales: rows(sales) as unknown as ReportSource['sales'],
    deposits: deposits.docs.map((d) => ({ id: d.id, amountCents: Number(d.data().amountCents ?? 0), status: String(d.data().status ?? '') })),
    users: us,
  };
}

/** Saves to exports/{uid}/… and returns the 15-minute URL. */
export async function saveExport(uid: string, fileName: string, data: Buffer | string, contentType: string) {
  const path = storagePaths.export(uid, `${Date.now()}_${fileName}`);
  const saved = await saveAndSign(path, data, contentType, EXPORT_URL_TTL_MINUTES, fileName);
  return { url: saved.url, fileName, expiresAt: saved.expiresAt, path };
}
