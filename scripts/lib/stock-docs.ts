/**
 * Pure builders for the stock seed (no Firebase imports, no I/O): turn `scripts/data/stock.ts` into
 * `cars/{carId}` documents and validate them against the shared zod schemas. Dates are JS `Date`s; the
 * caller converts them to Firestore Timestamps. Used by `scripts/seed-stock.ts` and `scripts/seed.ts`,
 * tested in `scripts/test/stock-docs.test.ts`.
 */
import {
  appSettingsSchema,
  bookingSettingsSchema,
  businessSettingsSchema,
  carSchema,
  carSlug,
  depositSettingsSchema,
  financeSettingsSchema,
  legalSettingsSchema,
} from '@sda/shared';
import { defaultSettingsDocs, type SettingsDocs } from '@sda/shared/demo';
import { STOCK_CARS, type StockCarFixture } from '../data/stock';

export const SEED_STOCK_ACTOR = 'seed-stock';

export type StockCarDoc = { id: string } & Record<string, unknown>;

export interface BuildStockOptions {
  /** Reference time: createdAt = now - daysListed (keeps the newest-first order stable). */
  now?: Date;
  /** Audit actor for createdBy/updatedBy. */
  actor?: string;
  /** Override the image id per photo (e.g. https download URLs after a Storage upload). */
  imageId?: (car: StockCarFixture, carId: string, file: string) => string;
  cars?: StockCarFixture[];
}

/** Deterministic doc id: SDA1001 → car-sda1001. */
export const stockCarId = (stockNo: string) => `car-${stockNo.toLowerCase()}`;

/** `local:cars/<photoKey>/<file>` – served as /images/cars/<photoKey>/<file> by the web app. */
export const localImageId = (photoKey: string, file: string) => `local:cars/${photoKey}/${file}`;

const DAY_MS = 86_400_000;

export function buildStockCarDocs(opts: BuildStockOptions = {}): StockCarDoc[] {
  const now = opts.now ?? new Date();
  const actor = opts.actor ?? SEED_STOCK_ACTOR;
  const cars = opts.cars ?? STOCK_CARS;
  return cars.map((c) => {
    const id = stockCarId(c.stockNo);
    const at = new Date(now.getTime() - c.daysListed * DAY_MS);
    return {
      id,
      stockNo: c.stockNo,
      slug: carSlug(c),
      vin: '',
      rego: '',
      regoExpiry: null,
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
      features: [...c.features],
      description: c.description,
      priceCents: c.price * 100,
      status: c.status,
      published: c.published,
      images: c.photos.map((p, order) => ({
        id: opts.imageId ? opts.imageId(c, id, p.file) : localImageId(c.photoKey, p.file),
        order,
        isCover: order === 0,
        alt: p.alt,
      })),
      syndication: { carsales: false, gumtree: false, facebook: false },
      searchText: [c.make, c.model, c.variant, c.stockNo].filter(Boolean).join(' ').toLowerCase(),
      soldAt: null,
      reservedAt: null,
      createdAt: at,
      createdBy: actor,
      updatedAt: at,
      updatedBy: actor,
      deletedAt: null,
    };
  });
}

/** The highest SDA number in the stock + 1 (settings/app nextStockNo for a fresh project). */
export function nextStockNoAfter(cars: { stockNo: string }[] = STOCK_CARS): number {
  const max = cars.reduce((m, c) => Math.max(m, Number(/^SDA(\d+)$/.exec(c.stockNo)?.[1] ?? 0)), 1000);
  return max + 1;
}

/** settings/* docs from the shared defaults, with nextStockNo following the seeded stock. */
export function buildStockSettingsDocs(opts: { now?: Date; actor?: string } = {}): SettingsDocs {
  return defaultSettingsDocs(
    { updatedAt: opts.now ?? new Date(), updatedBy: opts.actor ?? SEED_STOCK_ACTOR },
    { nextStockNo: nextStockNoAfter() },
  );
}

const SETTINGS_SCHEMAS = {
  business: businessSettingsSchema,
  booking: bookingSettingsSchema,
  deposit: depositSettingsSchema,
  finance: financeSettingsSchema,
  legal: legalSettingsSchema,
  app: appSettingsSchema,
} as const;

/** zod issues as short "path: message" strings (empty = valid). */
const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);

/** Validate a car doc (Dates or Timestamps) against the stored-document schema. */
export function validateCarDoc(doc: StockCarDoc): string[] {
  const { id: _id, ...data } = doc;
  return issues(carSchema.safeParse(data));
}

export function validateSettingsDoc(id: keyof SettingsDocs, data: Record<string, unknown>): string[] {
  return issues(SETTINGS_SCHEMAS[id].safeParse(data));
}
