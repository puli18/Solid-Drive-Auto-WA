/** Display + input helpers for the admin (money in cents, dates in the dealership time zone). */
import {
  type CarStatus,
  DEFAULT_TIMEZONE,
  dateKeyInTz,
  formatAUD,
  formatInTz,
  fromCents,
  toCents,
  todayInTz,
} from '@sda/shared';

export const TZ = DEFAULT_TIMEZONE;

export const money = (cents: number | null | undefined, opts?: { cents?: boolean }) =>
  cents == null || Number.isNaN(cents) ? '–' : formatAUD(cents, { cents: opts?.cents ?? 'auto' });

/** Dollars string for an input from cents ('' for null). */
export const centsToInput = (cents: number | null | undefined) =>
  cents == null ? '' : String(fromCents(cents).toFixed(2)).replace(/\.00$/, '');

/** Cents from a dollars input string (0 for blank, NaN for invalid). */
export const inputToCents = (v: string | number | null | undefined) => {
  if (v === '' || v == null) return 0;
  return toCents(v);
};

export const dateAU = (d: Date | null | undefined) => (d ? formatInTz(d, 'd MMM yyyy', TZ) : '–');
export const dateShort = (d: Date | null | undefined) => (d ? formatInTz(d, 'd MMM', TZ) : '–');
export const dateTimeAU = (d: Date | null | undefined) => (d ? formatInTz(d, 'EEE d MMM, h:mm a', TZ) : '–');
export const timeAU = (d: Date | null | undefined) => (d ? formatInTz(d, 'h:mm a', TZ) : '–');
export const dateKey = (d: Date | null | undefined) => (d ? dateKeyInTz(d, TZ) : '');
export const today = () => todayInTz(TZ);

export function relativeDays(d: Date | null | undefined): string {
  if (!d) return '–';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return dateAU(d);
}

export const STATUS_TONE: Record<CarStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-transparent',
  available: 'bg-success/12 text-success border-success/25',
  reserved: 'bg-warning/12 text-warning border-warning/25',
  sold: 'bg-foreground text-background border-transparent',
  withdrawn: 'bg-transparent text-muted-foreground border-border line-through decoration-1',
};

export function initials(name: string | null | undefined): string {
  return (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
