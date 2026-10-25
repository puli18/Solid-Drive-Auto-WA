/**
 * PUBLIC read layer (browser): route loaders of the public site call these.
 *
 *   import { getPublishedCars, getCarBySlug, getLatestAvailableCars, getPublicSettings } from '@/lib/data/public';
 *
 * Firebase mode: Firestore client SDK (loaded lazily, so it stays out of the demo bundle); public reads are
 * allowed by the security rules (published cars, the public settings docs). Results are memoised for 60 s
 * per page session so layout + page loaders share one read.
 * Demo mode: the bundled fixtures (pristine – viewer edits in the admin overlay are not shown publicly).
 * Only published, non-deleted cars with status available/reserved/sold are ever returned; dates are ISO strings.
 */
import type { PublicCar } from '@sda/shared';
import { isPublicCar, sortNewestFirst, toPublicCar, withSettingsDefaults } from './common';
import { demoBase } from './demo/store';
import { DEMO_MODE } from './mode';
import type { PublicSettings } from './types';

export type { PublicCar, PublicSettings };

const TTL_MS = 60_000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key));
  return value;
}

/** Firestore client helpers, imported on first use. */
async function firestore() {
  const [fs, { getDb }] = await Promise.all([import('firebase/firestore'), import('../firebase-db')]);
  const plain = (value: unknown): unknown => {
    if (value instanceof fs.Timestamp) return value.toDate();
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
    }
    return value;
  };
  const rows = (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) =>
    snap.docs.map((d) => plain({ id: d.id, ...d.data() }) as Record<string, unknown>);
  return { fs, db: getDb(), plain, rows };
}

export interface PublishedCarsOptions {
  /** Include sold cars (they drop out of /cars but appear in "similar cars"/sitemaps if wanted). */
  includeSold?: boolean;
  limit?: number;
}

function loadPublishedRows(max: number): Promise<Record<string, unknown>[]> {
  if (DEMO_MODE) return Promise.resolve(demoBase().cars);
  return cached(`cars:${max}`, async () => {
    const { fs, db, rows } = await firestore();
    return rows(await fs.getDocs(fs.query(fs.collection(db, 'cars'), fs.where('published', '==', true), fs.limit(max))));
  });
}

/** All published cars, newest first. Inventory is small: filter/sort further in memory for /cars. */
export async function getPublishedCars(opts: PublishedCarsOptions = {}): Promise<PublicCar[]> {
  const rows = await loadPublishedRows(opts.limit ?? 500);
  return sortNewestFirst(rows.filter((c) => isPublicCar(c) && (opts.includeSold || c.status !== 'sold'))).map(toPublicCar);
}

/** Latest N available cars (home page "featured"). */
export async function getLatestAvailableCars(n = 6): Promise<PublicCar[]> {
  return (await getPublishedCars()).filter((c) => c.status === 'available').slice(0, n);
}

/** A published car by slug – sold cars included (their page still loads with a Sold badge). */
export async function getCarBySlug(slug: string): Promise<PublicCar | null> {
  let row: Record<string, unknown> | undefined;
  if (DEMO_MODE) {
    row = demoBase().cars.find((c) => c.slug === slug);
  } else {
    row = await cached(`car:${slug}`, async () => {
      const { fs, db, rows } = await firestore();
      const q = fs.query(fs.collection(db, 'cars'), fs.where('slug', '==', slug), fs.where('published', '==', true), fs.limit(1));
      return rows(await fs.getDocs(q))[0];
    });
  }
  return row && isPublicCar(row) ? toPublicCar(row) : null;
}

/** Public settings (business, booking, deposit, finance, legal), each merged over PLACEHOLDER defaults. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const ids = ['business', 'booking', 'deposit', 'finance', 'legal'] as const;
  const docs: (Record<string, unknown> | null | undefined)[] = DEMO_MODE
    ? ids.map((id) => demoBase().settings[id] as Record<string, unknown> | undefined)
    : await cached('settings', async () => {
        const { fs, db, plain } = await firestore();
        return Promise.all(
          ids.map((id) =>
            fs
              .getDoc(fs.doc(db, 'settings', id))
              .then((s) => (s.exists() ? (plain(s.data()) as Record<string, unknown>) : null))
              .catch(() => null),
          ),
        );
      });
  return {
    business: withSettingsDefaults('business', docs[0]),
    booking: withSettingsDefaults('booking', docs[1]),
    deposit: withSettingsDefaults('deposit', docs[2]),
    finance: withSettingsDefaults('finance', docs[3]),
    legal: withSettingsDefaults('legal', docs[4]),
  };
}
