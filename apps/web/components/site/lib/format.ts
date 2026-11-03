/** Display helpers for the public site (pure, server + client safe). */
import {
  BODY_TYPE_LABELS,
  formatAUD,
  type BodyType,
  type BusinessSettings,
  FUEL_TYPE_LABELS,
  type FuelType,
  TRANSMISSION_LABELS,
  type Transmission,
} from '@sda/shared';

export const nf = new Intl.NumberFormat('en-AU');

/** Shown for a field the dealer hasn't supplied yet (year or odometer stored as 0). */
export const TBC = 'TBC';

/** "64,000 km"; an odometer of 0 means "not known yet" and shows as TBC. */
export function formatKm(km: number): string {
  return km > 0 ? `${nf.format(km)} km` : TBC;
}

/** Price on application: a car stored with priceCents 0 shows "Call for price". */
export const CALL_FOR_PRICE = 'Call for price';
export const hasPrice = (car: { priceCents: number }) => car.priceCents > 0;
export function formatPrice(priceCents: number): string {
  return priceCents > 0 ? formatAUD(priceCents) : CALL_FOR_PRICE;
}

/** Year for display ("TBC" when not known yet). */
export const formatYear = (year: number) => (year > 0 ? String(year) : TBC);

export const bodyLabel = (b: string) => BODY_TYPE_LABELS[b as BodyType] ?? b;
export const fuelLabel = (f: string) => FUEL_TYPE_LABELS[f as FuelType] ?? f;
export const transmissionLabel = (t: string) => TRANSMISSION_LABELS[t as Transmission] ?? t;

/** "2021 Toyota Hilux" (no variant) – card / heading line. A 0 (unknown) year is left out. */
export function carName(car: { year: number; make: string; model: string }): string {
  return [car.year > 0 ? car.year : '', car.make, car.model].filter(Boolean).join(' ');
}

export function addressLines(b: Pick<BusinessSettings, 'address'>): string[] {
  const a = b.address;
  return [a.line1, a.line2, `${a.suburb} ${a.state} ${a.postcode}`.trim()].filter(Boolean) as string[];
}

export function addressOneLine(b: Pick<BusinessSettings, 'address'>): string {
  return addressLines(b).join(', ');
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function mapsUrl(b: Pick<BusinessSettings, 'address' | 'name'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name}, ${addressOneLine(b)}`)}`;
}

export function mapsEmbedUrl(b: Pick<BusinessSettings, 'address' | 'name'>): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(addressOneLine(b))}&output=embed`;
}

/** Free-text hours ("Mon–Fri 9:00am–5:30pm, Sat 9:00am–1:00pm, Sun closed") → rows. */
export function hoursRows(hours: string): string[] {
  return hours
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Split admin-entered long text into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
