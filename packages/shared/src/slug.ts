/** Slug helpers. Car slug format: `{year}-{make}-{model}-{variant}-{stockNo}`, lowercased and hyphenated. */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export interface CarSlugInput {
  year: number | string;
  make: string;
  model: string;
  variant?: string | null;
  stockNo: string;
}

export function carSlug(car: CarSlugInput): string {
  return [car.year, car.make, car.model, car.variant ?? '', car.stockNo]
    .map((p) => slugify(String(p)))
    .filter(Boolean)
    .join('-');
}

/** The stock number is always the last segment of the slug (stock numbers are hyphen-free by convention). */
export function stockNoFromSlug(slug: string): string | null {
  const last = slug.split('-').pop();
  return last ? last.toUpperCase() : null;
}

/** Human title used in listings and Stripe line items, e.g. "2021 Toyota Hilux SR5". */
export function carTitle(car: {
  year: number;
  make: string;
  model: string;
  variant?: string | null;
}): string {
  return [car.year, car.make, car.model, car.variant].filter(Boolean).join(' ');
}
