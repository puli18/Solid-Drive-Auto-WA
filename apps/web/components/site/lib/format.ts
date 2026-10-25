/** Display helpers for the public site (pure, server + client safe). */
import {
  BODY_TYPE_LABELS,
  type BodyType,
  type BusinessSettings,
  FUEL_TYPE_LABELS,
  type FuelType,
  TRANSMISSION_LABELS,
  type Transmission,
} from '@sda/shared';

export const nf = new Intl.NumberFormat('en-AU');

export function formatKm(km: number): string {
  return `${nf.format(km)} km`;
}

export const bodyLabel = (b: string) => BODY_TYPE_LABELS[b as BodyType] ?? b;
export const fuelLabel = (f: string) => FUEL_TYPE_LABELS[f as FuelType] ?? f;
export const transmissionLabel = (t: string) => TRANSMISSION_LABELS[t as Transmission] ?? t;

/** "2021 Toyota Hilux" (no variant) – card / heading line. */
export function carName(car: { year: number; make: string; model: string }): string {
  return `${car.year} ${car.make} ${car.model}`;
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

/** Free-text hours ("Mon–Fri 9:00–17:00, Sat 9:00–13:00, Sun closed") → rows. */
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
