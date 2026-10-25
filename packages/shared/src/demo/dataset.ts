/**
 * buildDemoDataset() – the complete sample dataset (20 cars, financials, expenses, vendors, bookings,
 * enquiries, a sale, a deposit, users, settings, audit log) as plain objects with JS `Date`s.
 *
 *  - scripts/seed.ts converts Dates → Firestore Timestamps and writes it to the emulators.
 *  - apps/web/lib/data (demo adapter) serves it directly when NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Deterministic: the same `now` always produces the same data (dates are relative to `now`).
 */
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_DEPOSIT_AMOUNT_CENTS,
  DEFAULT_DEPOSIT_TERMS_TEXT,
  DEFAULT_FINANCE_DISCLAIMER,
  DEFAULT_FINANCE_RATE_PCT,
  DEFAULT_LEGAL_SETTINGS,
  DEPOSIT_TERMS_VERSION,
  type Role,
} from '../constants';
import { splitGstInclusive } from '../money';
import { carSlug, carTitle } from '../slug';
import { addDaysToDateKey, slotKey, slotLockId, todayInTz, weekdayOfDateKey, zonedToUtc } from '../time';
import { DEMO_ACCOUNTS, DEMO_CAR_FIXTURES, DEMO_EXPENSE_TEMPLATES, DEMO_VENDORS } from './fixtures';

/** A stored document with Firestore Timestamps replaced by Date. */
export type DemoDoc = { id: string } & Record<string, unknown>;

export interface DemoDataset {
  users: DemoDoc[];
  settings: Record<'business' | 'booking' | 'deposit' | 'finance' | 'legal' | 'app', Record<string, unknown>>;
  vendors: DemoDoc[];
  cars: DemoDoc[];
  carFinancials: DemoDoc[];
  /** All expenses (each has `carId`; stored at cars/{carId}/expenses/{id}). */
  expenses: DemoDoc[];
  sales: DemoDoc[];
  deposits: DemoDoc[];
  bookings: DemoDoc[];
  slotLocks: DemoDoc[];
  slotCounts: DemoDoc[];
  enquiries: DemoDoc[];
  auditLog: DemoDoc[];
}

export interface BuildDemoOptions {
  now?: Date;
  /** Override user ids (seed uses the fixed demo ids too). */
  uids?: Partial<Record<Role, string>>;
}

const SEED = 'seed';

export function buildDemoDataset(opts: BuildDemoOptions = {}): DemoDataset {
  const now = opts.now ?? new Date();
  const TZ = DEFAULT_BUSINESS_SETTINGS.timezone;
  const uids = { admin: opts.uids?.admin ?? DEMO_ACCOUNTS.admin.uid, staff: opts.uids?.staff ?? DEMO_ACCOUNTS.staff.uid };
  const today = todayInTz(TZ, now);
  const daysAgo = (n: number, hour = 10) =>
    zonedToUtc(addDaysToDateKey(today, -n), `${String(hour).padStart(2, '0')}:00`, TZ);
  const audit = (at: Date, by = SEED) => ({ createdAt: at, createdBy: by, updatedAt: at, updatedBy: by, deletedAt: null });

  // Deterministic pseudo-random.
  let rngState = 42;
  const rand = () => (rngState = (rngState * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

  const ds: DemoDataset = {
    users: [],
    settings: {} as DemoDataset['settings'],
    vendors: [],
    cars: [],
    carFinancials: [],
    expenses: [],
    sales: [],
    deposits: [],
    bookings: [],
    slotLocks: [],
    slotCounts: [],
    enquiries: [],
    auditLog: [],
  };

  // ---- users ----
  for (const role of ['admin', 'staff'] as const) {
    const a = DEMO_ACCOUNTS[role];
    ds.users.push({
      id: uids[role],
      name: a.name,
      email: a.email,
      role,
      active: true,
      lastLoginAt: null,
      invitedAt: daysAgo(120),
      ...audit(daysAgo(120)),
    });
  }

  // ---- settings ----
  const meta = { updatedAt: daysAgo(30), updatedBy: SEED };
  ds.settings = {
    business: { ...DEFAULT_BUSINESS_SETTINGS, address: { ...DEFAULT_BUSINESS_SETTINGS.address }, ...meta },
    booking: { ...structuredClone(DEFAULT_BOOKING_SETTINGS), ...meta },
    deposit: {
      amountCents: DEFAULT_DEPOSIT_AMOUNT_CENTS,
      termsText: DEFAULT_DEPOSIT_TERMS_TEXT,
      termsVersion: DEPOSIT_TERMS_VERSION,
      enabled: true,
      ...meta,
    },
    finance: { indicativeRatePct: DEFAULT_FINANCE_RATE_PCT, disclaimer: DEFAULT_FINANCE_DISCLAIMER, ...meta },
    legal: { ...DEFAULT_LEGAL_SETTINGS, ...meta },
    app: { ...DEFAULT_APP_SETTINGS, nextStockNo: 1001 + DEMO_CAR_FIXTURES.length, ...meta },
  };

  // ---- vendors ----
  for (const v of DEMO_VENDORS) ds.vendors.push({ ...v, ...audit(daysAgo(200)) });

  // ---- cars, financials, expenses ----
  const seeded: { id: string; stockNo: string; title: string; status: string; published: boolean; priceCents: number }[] = [];
  for (const [i, c] of DEMO_CAR_FIXTURES.entries()) {
    const stockNo = `SDA${1001 + i}`;
    const id = `car-${stockNo.toLowerCase()}`;
    const title = carTitle(c);
    const priceCents = c.price * 100;
    const createdAt = daysAgo(c.daysInStock);
    const imgNo = String(c.img).padStart(2, '0');
    const creator = i % 3 === 0 ? uids.admin : uids.staff;

    ds.cars.push({
      id,
      stockNo,
      slug: carSlug({ ...c, stockNo }),
      vin: `MR0${String(1000000000000 + i * 7919).slice(0, 14)}`,
      rego: `1${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(66 + ((i * 3) % 24))}${String.fromCharCode(67 + ((i * 7) % 23))}${String(100 + i * 37).slice(-3)}`,
      regoExpiry: daysAgo(-(60 + i * 11)),
      make: c.make,
      model: c.model,
      variant: c.variant,
      year: c.year,
      bodyType: c.bodyType,
      transmission: c.transmission,
      fuel: c.fuel,
      engine: c.engine,
      colour: c.colour,
      km: c.km,
      features: c.features,
      description:
        `This ${title} in ${c.colour} has travelled ${c.km.toLocaleString('en-AU')} km and comes ` +
        `with a ${c.engine} engine and ${c.transmission} transmission. Inspected and detailed by our team in Perth. ` +
        `Finance and trade-ins welcome – book a test drive today.`,
      priceCents,
      status: c.status,
      published: c.published,
      images: [{ id: `local:cars/car-${imgNo}.webp`, order: 0, isCover: true, alt: title }],
      syndication: { carsales: c.published, gumtree: false, facebook: c.published && i % 2 === 0 },
      searchText: `${c.make} ${c.model} ${c.variant} ${stockNo}`.toLowerCase(),
      soldAt: c.status === 'sold' ? daysAgo(4) : null,
      reservedAt: c.status === 'reserved' ? daysAgo(2) : null,
      ...audit(createdAt, creator),
    });

    const listExGst = splitGstInclusive(priceCents, 10).amountExGstCents;
    const purchaseEx = Math.round((listExGst * (0.72 + rand() * 0.1)) / 10000) * 10000;
    const gstOnPurchase = c.source === 'auction' || c.source === 'wholesale';
    ds.carFinancials.push({
      id,
      purchaseDate: daysAgo(c.daysInStock + 2),
      purchasePriceCents: purchaseEx,
      purchaseGstCents: gstOnPurchase ? Math.round(purchaseEx * 0.1) : 0,
      source: c.source,
      sellerName:
        c.source === 'auction' ? 'Westside Vehicle Auctions' : c.source === 'wholesale' ? 'Metro Wholesale Cars' : 'Private seller',
      notes: '',
      ...audit(createdAt, uids.admin),
    });

    const n = 1 + Math.floor(rand() * 4);
    const templates = [...DEMO_EXPENSE_TEMPLATES].sort(() => rand() - 0.5).slice(0, n);
    if (c.source === 'auction' && !templates.some((t) => t.category === 'auction-fees')) templates.push(DEMO_EXPENSE_TEMPLATES[6]!);
    for (const [j, t] of templates.entries()) {
      const total = Math.round(t.min + rand() * (t.max - t.min)) * 100;
      const vendor = DEMO_VENDORS.find((v) => v.id === t.vendor)!;
      const gstApplies = vendor.abn !== '' && t.category !== 'registration';
      const split = splitGstInclusive(total, gstApplies ? 10 : 0);
      const at = daysAgo(Math.max(0, c.daysInStock - j * 2));
      const loggedBy = j % 2 === 0 ? uids.staff : uids.admin;
      ds.expenses.push({
        id: `exp-${stockNo.toLowerCase()}-${j + 1}`,
        carId: id,
        date: at,
        category: t.category,
        description: t.description,
        vendorId: vendor.id,
        vendorName: vendor.name,
        invoiceNo: `INV-${10000 + i * 10 + j}`,
        ...split,
        receiptPath: null,
        loggedBy,
        ...audit(at, loggedBy),
      });
    }

    ds.auditLog.push({
      id: `audit-${id}-create`,
      actorUid: creator,
      action: 'create',
      entity: 'car',
      entityId: id,
      carId: id,
      before: null,
      after: { stockNo, status: 'draft' },
      at: createdAt,
    });
    seeded.push({ id, stockNo, title, status: c.status, published: c.published, priceCents });
  }

  // ---- sale + deposit ----
  const sold = seeded.find((c) => c.status === 'sold')!;
  const salePrice = splitGstInclusive(sold.priceCents - 100_000, 10);
  ds.sales.push({
    id: 'sale-0001',
    carId: sold.id,
    stockNo: sold.stockNo,
    saleDate: daysAgo(4, 14),
    salePriceCents: salePrice.amountExGstCents,
    saleGstCents: salePrice.gstCents,
    buyer: {
      name: 'Jordan Mitchell',
      address: '42 Example Street, Scarborough WA 6019',
      phone: '0412 555 019',
      email: 'jordan.mitchell@example.com',
      licenceNo: 'WA1234567',
    },
    depositId: null,
    tradeIn: null,
    paymentMethod: 'bank-transfer',
    financeCompany: '',
    warranty: '3 months / 5,000 km statutory warranty',
    deliveryDate: daysAgo(2, 11),
    salespersonUid: uids.staff,
    documents: [],
    notes: 'Sample sale.',
    ...audit(daysAgo(4, 14), uids.staff),
  });

  const reserved = seeded.find((c) => c.status === 'reserved')!;
  ds.deposits.push({
    id: 'dep-0001',
    carId: reserved.id,
    carTitle: reserved.title,
    stockNo: reserved.stockNo,
    amountCents: DEFAULT_DEPOSIT_AMOUNT_CENTS,
    customer: { name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '0433 555 021' },
    stripeSessionId: 'cs_test_seed_0001',
    stripePaymentIntentId: 'pi_test_seed_0001',
    status: 'paid',
    termsAcceptedAt: daysAgo(2, 9),
    termsVersion: DEPOSIT_TERMS_VERSION,
    paidAt: daysAgo(2, 9),
    ...audit(daysAgo(2, 9), 'system'),
  });

  // ---- bookings (+ slot locks / counts) ----
  const openDates: string[] = [];
  for (let d = today; openDates.length < 3; ) {
    d = addDaysToDateKey(d, 1);
    if ((DEFAULT_BOOKING_SETTINGS.weeklyHours[weekdayOfDateKey(d)] ?? []).length) openDates.push(d);
  }
  const [d1, d2, d3] = openDates as [string, string, string];
  const available = seeded.filter((c) => c.status === 'available' && c.published);
  const customers = [
    { name: 'Liam Nguyen', phone: '0400 555 101', email: 'liam.nguyen@example.com' },
    { name: 'Chloe Williams', phone: '0400 555 102', email: 'chloe.williams@example.com' },
    { name: 'Noah Kaur', phone: '0400 555 103', email: 'noah.kaur@example.com' },
    { name: 'Olivia Brown', phone: '0400 555 104', email: 'olivia.brown@example.com' },
    { name: 'Jack Thompson', phone: '0400 555 105', email: 'jack.thompson@example.com' },
  ];
  const rows = [
    { car: available[0]!, date: d1, time: '10:00', type: 'test-drive', status: 'confirmed', source: 'web', cust: customers[0]! },
    { car: available[1]!, date: d1, time: '10:00', type: 'inspection', status: 'confirmed', source: 'web', cust: customers[1]! },
    { car: available[2]!, date: d2, time: '14:00', type: 'test-drive', status: 'confirmed', source: 'staff', cust: customers[2]! },
    { car: available[3]!, date: d3, time: '09:00', type: 'inspection', status: 'confirmed', source: 'web', cust: customers[3]! },
    { car: available[0]!, date: addDaysToDateKey(today, -3), time: '11:00', type: 'test-drive', status: 'attended', source: 'web', cust: customers[4]! },
  ];
  const counts = new Map<string, number>();
  for (const [i, r] of rows.entries()) {
    const startAt = zonedToUtc(r.date, r.time, TZ);
    const endAt = new Date(startAt.getTime() + DEFAULT_BOOKING_SETTINGS.slotMinutes * 60_000);
    const id = `booking-${String(i + 1).padStart(4, '0')}`;
    const lockId = slotLockId(r.car.id, startAt, TZ);
    const createdAt = new Date(startAt.getTime() - 3 * 86_400_000);
    ds.bookings.push({
      id,
      carId: r.car.id,
      carTitle: r.car.title,
      stockNo: r.car.stockNo,
      type: r.type,
      startAt,
      endAt,
      customer: r.cust,
      licenceConfirmed: r.type === 'test-drive',
      status: r.status,
      // sha256 of a throwaway token – demo bookings can't be managed via a link.
      manageToken: `demo-token-hash-${i + 1}`,
      notes: r.source === 'staff' ? 'Booked over the phone.' : '',
      source: r.source,
      slotLockId: lockId,
      reminderSentAt: null,
      cancelledAt: null,
      ...audit(createdAt, r.source === 'staff' ? uids.staff : 'public'),
    });
    if (r.status === 'confirmed') {
      ds.slotLocks.push({ id: lockId, bookingId: id, createdAt });
      const key = slotKey(startAt, TZ);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of counts) ds.slotCounts.push({ id: key, count });

  // ---- enquiries ----
  const c0 = seeded[0]!;
  const c9 = seeded[9]!;
  const enquiries = [
    {
      type: 'general', carId: c0.id, carTitle: c0.title, status: 'new', at: daysAgo(0, 9),
      customer: { name: 'Mia Anderson', phone: '0411 555 201', email: 'mia.anderson@example.com' },
      message: 'Hi, is the Hilux still available? Does it come with a full service history?',
    },
    {
      type: 'general', carId: c9.id, carTitle: c9.title, status: 'contacted', at: daysAgo(2, 15), assignedTo: uids.staff,
      customer: { name: 'Ethan Wilson', phone: '0411 555 202', email: 'ethan.wilson@example.com' },
      message: 'What would the weekly repayments be on the Patrol over 5 years with $10k down?',
      notes: [{ text: 'Called back, sent finance estimate by email.', by: uids.staff, at: daysAgo(1, 10) }],
    },
    {
      type: 'trade-in', carId: null, status: 'new', at: daysAgo(1, 18),
      customer: { name: 'Isla Martin', phone: '0411 555 203', email: 'isla.martin@example.com' },
      message: 'Looking to trade in my Corolla towards an SUV.',
      tradeInVehicle: { rego: '1ABC234', make: 'Toyota', model: 'Corolla', year: 2016, km: 112_000, condition: 'good', images: [] },
    },
    {
      type: 'general', carId: null, status: 'won', at: daysAgo(10, 11), assignedTo: uids.admin,
      customer: { name: 'Jordan Mitchell', phone: '0412 555 019', email: 'jordan.mitchell@example.com' },
      message: 'Do you have any Golfs coming in?',
    },
  ];
  for (const [i, e] of enquiries.entries()) {
    const { at, ...rest } = e;
    ds.enquiries.push({
      id: `enq-${String(i + 1).padStart(4, '0')}`,
      assignedTo: null,
      notes: [],
      tradeInVehicle: null,
      bookingId: null,
      ...rest,
      ...audit(at, 'public'),
    });
  }

  return ds;
}
