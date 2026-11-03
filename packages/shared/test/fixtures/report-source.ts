/**
 * Test-only report input: a few cars with purchase details, expenses and one sale, so the report
 * builders can be exercised now that the bundled demo dataset holds real stock with no financials.
 * Values are made up for the tests and never shipped.
 */
import { splitGstInclusive } from '../../src/money';
import type { ReportSource, SourceExpense } from '../../src/reports';
import { addDaysToDateKey, todayInTz, zonedToUtc } from '../../src/time';

const TZ = 'Australia/Perth';

export function testReportSource(now: Date): ReportSource {
  const today = todayInTz(TZ, now);
  const daysAgo = (n: number, hour = 10) => zonedToUtc(addDaysToDateKey(today, -n), `${String(hour).padStart(2, '0')}:00`, TZ);

  const cars: ReportSource['cars'] = [
    { id: 'car-t1', stockNo: 'TST1', year: 2019, make: 'Testmake', model: 'Alpha', variant: 'GX', km: 80_000, status: 'sold', priceCents: 2_000_000, createdAt: daysAgo(40), soldAt: daysAgo(4) },
    { id: 'car-t2', stockNo: 'TST2', year: 2020, make: 'Testmake', model: 'Beta', variant: '', km: 60_000, status: 'available', priceCents: 1_500_000, createdAt: daysAgo(30), soldAt: null },
    { id: 'car-t3', stockNo: 'TST3', year: 2018, make: 'Othermake', model: 'Gamma', variant: 'LX', km: 120_000, status: 'available', priceCents: 900_000, createdAt: daysAgo(20), soldAt: null },
    { id: 'car-t4', stockNo: 'TST4', year: 0, make: 'Othermake', model: 'Delta', variant: '', km: 0, status: 'reserved', priceCents: 0, createdAt: daysAgo(10), soldAt: null },
  ];
  const carFinancials: ReportSource['carFinancials'] = cars.map((c, i) => ({
    id: c.id,
    purchaseDate: daysAgo(42 - i * 10),
    purchasePriceCents: 1_000_000 - i * 100_000,
    purchaseGstCents: 0,
  }));
  const rows: [string, string, number, number][] = [
    ['car-t1', 'tyres', 90_000, 35],
    ['car-t1', 'detailing', 33_000, 30],
    ['car-t1', 'servicing', 49_500, 25],
    ['car-t2', 'tyres', 77_000, 20],
    ['car-t3', 'mechanical', 66_000, 15],
  ];
  const expenses: SourceExpense[] = rows.map(([carId, category, total, ago], i) => ({
    id: `exp-t${i + 1}`,
    carId,
    date: daysAgo(ago),
    category,
    description: `Test ${category}`,
    vendorName: 'Test Vendor',
    invoiceNo: `T-${100 + i}`,
    ...splitGstInclusive(total, 10),
    receiptPath: null,
    loggedBy: 'u-staff',
  }));
  const sale = splitGstInclusive(1_900_000, 10);
  return {
    cars,
    carFinancials,
    expenses,
    sales: [
      {
        id: 'sale-t1',
        carId: 'car-t1',
        saleDate: daysAgo(4, 14),
        salePriceCents: sale.amountExGstCents,
        saleGstCents: sale.gstCents,
        buyer: { name: 'Test Buyer' },
        depositId: null,
        tradeIn: null,
        paymentMethod: 'bank-transfer',
        financeCompany: '',
        salespersonUid: 'u-staff',
      },
    ],
    deposits: [],
    users: [
      { id: 'u-admin', name: 'Test Admin' },
      { id: 'u-staff', name: 'Test Staff' },
    ],
  };
}
