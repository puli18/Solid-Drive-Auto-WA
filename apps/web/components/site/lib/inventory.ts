/**
 * Inventory filtering/sorting for /cars (filters live in the URL query string) and the home page.
 * Inventory is small, so the server page filters the published list in memory.
 */
import type { PublicCar } from '@sda/shared';

export const SORTS = [
  { value: 'newest', label: 'Newest listings' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'year-desc', label: 'Year: newest first' },
  { value: 'km-asc', label: 'Kilometres: lowest first' },
] as const;
export type SortValue = (typeof SORTS)[number]['value'];

export interface InventoryFilters {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  /** Dollars */
  priceMin?: number;
  /** Dollars */
  priceMax?: number;
  kmMax?: number;
  body?: string[];
  transmission?: string;
  fuel?: string;
  drive?: '4x4';
  sort: SortValue;
}

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const num = (v: string | string[] | undefined) => {
  const s = first(v);
  if (!s) return undefined;
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseFilters(sp: Params): InventoryFilters {
  const sort = first(sp.sort);
  const body = first(sp.body);
  return {
    make: first(sp.make),
    model: first(sp.model),
    yearMin: num(sp.yearMin),
    yearMax: num(sp.yearMax),
    priceMin: num(sp.priceMin),
    priceMax: num(sp.priceMax),
    kmMax: num(sp.kmMax),
    body: body ? body.split(',').filter(Boolean) : undefined,
    transmission: first(sp.transmission),
    fuel: first(sp.fuel),
    drive: first(sp.drive) === '4x4' ? '4x4' : undefined,
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortValue) : 'newest',
  };
}

/** Number of active filters (sort excluded). */
export function activeFilterCount(f: InventoryFilters): number {
  return [f.make, f.model, f.yearMin, f.yearMax, f.priceMin, f.priceMax, f.kmMax, f.body?.length, f.transmission, f.fuel, f.drive].filter(
    (v) => v !== undefined && v !== 0,
  ).length;
}

const FOUR_BY_FOUR = /\b(4x4|4wd|awd|4motion|all[- ]wheel)\b/i;
export function is4x4(car: Pick<PublicCar, 'variant' | 'engine' | 'model'>): boolean {
  return FOUR_BY_FOUR.test(`${car.variant ?? ''} ${car.engine ?? ''}`) || /^patrol|landcruiser|prado$/i.test(car.model);
}

const eq = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'accent' }) === 0;

export function applyFilters(cars: PublicCar[], f: InventoryFilters): PublicCar[] {
  const out = cars.filter((c) => {
    if (f.make && !eq(c.make, f.make)) return false;
    if (f.model && !eq(c.model, f.model)) return false;
    if (f.yearMin && c.year < f.yearMin) return false;
    if (f.yearMax && c.year > f.yearMax) return false;
    if (f.priceMin && c.priceCents < f.priceMin * 100) return false;
    if (f.priceMax && c.priceCents > f.priceMax * 100) return false;
    if (f.kmMax && c.km > f.kmMax) return false;
    if (f.body?.length && !f.body.includes(c.bodyType)) return false;
    if (f.transmission && c.transmission !== f.transmission) return false;
    if (f.fuel && c.fuel !== f.fuel) return false;
    if (f.drive === '4x4' && !is4x4(c)) return false;
    return true;
  });
  return sortCars(out, f.sort);
}

const created = (c: PublicCar) => (c.createdAt ? Date.parse(c.createdAt) : 0);

export function sortCars(cars: PublicCar[], sort: SortValue): PublicCar[] {
  const list = [...cars];
  const statusRank = (c: PublicCar) => (c.status === 'available' ? 0 : 1);
  const by: Record<SortValue, (a: PublicCar, b: PublicCar) => number> = {
    newest: (a, b) => created(b) - created(a),
    'price-asc': (a, b) => a.priceCents - b.priceCents,
    'price-desc': (a, b) => b.priceCents - a.priceCents,
    'year-desc': (a, b) => b.year - a.year || created(b) - created(a),
    'km-asc': (a, b) => a.km - b.km,
  };
  // Available cars first, reserved after – within the chosen order.
  return list.sort((a, b) => statusRank(a) - statusRank(b) || by[sort](a, b));
}

export interface FilterOptions {
  makes: string[];
  modelsByMake: Record<string, string[]>;
  years: number[];
  bodies: string[];
  transmissions: string[];
  fuels: string[];
  maxPrice: number;
  count: number;
}

export function filterOptions(cars: PublicCar[]): FilterOptions {
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  const makes = uniq(cars.map((c) => c.make)).sort();
  const modelsByMake: Record<string, string[]> = {};
  for (const m of makes) modelsByMake[m] = uniq(cars.filter((c) => c.make === m).map((c) => c.model)).sort();
  return {
    makes,
    modelsByMake,
    years: uniq(cars.map((c) => c.year)).sort((a, b) => b - a),
    bodies: uniq(cars.map((c) => c.bodyType)).sort(),
    transmissions: uniq(cars.map((c) => c.transmission)).sort(),
    fuels: uniq(cars.map((c) => c.fuel)).sort(),
    maxPrice: Math.max(0, ...cars.map((c) => Math.ceil(c.priceCents / 100))),
    count: cars.length,
  };
}

/** Days since listing (null when unknown). */
export function daysListed(car: Pick<PublicCar, 'createdAt'>, now = Date.now()): number | null {
  return car.createdAt ? Math.floor((now - Date.parse(car.createdAt)) / 86_400_000) : null;
}

export const NEW_ARRIVAL_DAYS = 14;

/** Body-type categories on the home page (images in public/images/categories). */
export const CATEGORIES = [
  { key: 'suv', label: 'SUV', image: '/images/categories/suv.webp', query: 'body=suv', match: (c: PublicCar) => c.bodyType === 'suv' },
  { key: 'ute', label: 'Ute', image: '/images/categories/ute.webp', query: 'body=ute,cab-chassis', match: (c: PublicCar) => c.bodyType === 'ute' || c.bodyType === 'cab-chassis' },
  { key: 'sedan', label: 'Sedan', image: '/images/categories/sedan.webp', query: 'body=sedan', match: (c: PublicCar) => c.bodyType === 'sedan' },
  { key: 'hatch', label: 'Hatch', image: '/images/categories/hatch.webp', query: 'body=hatch', match: (c: PublicCar) => c.bodyType === 'hatch' },
  { key: 'wagon', label: 'Wagon', image: '/images/categories/wagon.webp', query: 'body=wagon', match: (c: PublicCar) => c.bodyType === 'wagon' },
  { key: '4x4', label: '4x4 & AWD', image: '/images/categories/4x4.webp', query: 'drive=4x4', match: (c: PublicCar) => is4x4(c) },
] as const;

/** Similar cars: same body type first, then nearest price. Excludes the car itself; available/reserved only. */
export function similarCars(all: PublicCar[], car: PublicCar, n = 3): PublicCar[] {
  return all
    .filter((c) => c.id !== car.id && c.status !== 'sold')
    .map((c) => ({
      c,
      score: (c.bodyType === car.bodyType ? 0 : 1) * 1e9 + Math.abs(c.priceCents - car.priceCents) + (c.status === 'available' ? 0 : 5e8),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => x.c);
}
