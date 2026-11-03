/**
 * Build step (after `vite build`): writes dist/sitemap.xml and adds its absolute `Sitemap:` line to
 * dist/robots.txt (copied from public/robots.txt; demo builds disallow everything).
 * Car URLs: the published cars read from Firestore at build time (unauthenticated REST runQuery, allowed by
 * the public-read rules) when a real project is configured (VITE_FIREBASE_PROJECT_ID not demo-*); otherwise
 * (or if the read fails) only the static pages are listed. The static host has no server to query Firestore
 * at request time (see docs/DECISIONS.md). Site URL: VITE_SITE_URL (.env* or shell).
 * `--mode <mode>` picks the Vite env files (default production; build:preview passes preview).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { isPublicCar, sortNewestFirst } from '../lib/data/common';

const root = resolve(import.meta.dirname, '..');
const modeArg = process.argv.indexOf('--mode');
const mode = modeArg > -1 ? (process.argv[modeArg + 1] ?? 'production') : 'production';
const env = { ...loadEnv(mode, root, 'VITE_'), ...process.env };
const base = (env.VITE_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const demo = env.VITE_DEMO_MODE === 'true';

const STATIC = ['', '/cars', '/finance', '/trade-in', '/about', '/contact', '/warranty', '/faq', '/privacy', '/terms', '/deposit-terms'];

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : undefined);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

type FsValue = { stringValue?: string; booleanValue?: boolean; timestampValue?: string; nullValue?: null };

/** Published cars via the Firestore REST API (fields needed for the sitemap only). */
async function publishedCars(): Promise<Record<string, unknown>[]> {
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? '';
  if (!projectId || projectId.startsWith('demo-') || env.VITE_USE_EMULATORS === 'true') return [];
  const key = env.VITE_FIREBASE_API_KEY ? `?key=${encodeURIComponent(env.VITE_FIREBASE_API_KEY)}` : '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'cars' }],
        where: { fieldFilter: { field: { fieldPath: 'published' }, op: 'EQUAL', value: { booleanValue: true } } },
        limit: 500,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as { document?: { fields?: Record<string, FsValue> } }[];
  return rows.flatMap((r) => {
    const f = r.document?.fields;
    if (!f) return [];
    const val = (v?: FsValue) => (v?.timestampValue ? new Date(v.timestampValue) : (v?.stringValue ?? v?.booleanValue ?? null));
    return [{ slug: val(f.slug), status: val(f.status), published: val(f.published), deletedAt: val(f.deletedAt), createdAt: val(f.createdAt), updatedAt: val(f.updatedAt) }];
  });
}

let liveCars: Record<string, unknown>[] = [];
try {
  liveCars = await publishedCars();
} catch (err) {
  console.warn(`sitemap: could not read cars from Firestore (${err instanceof Error ? err.message : String(err)}); listing static pages only`);
}
const cars = sortNewestFirst(liveCars.filter((c) => isPublicCar(c) && c.status !== 'sold'));
const urls = [
  ...STATIC.map((p) => ({ loc: `${base}${p}`, freq: p === '' || p === '/cars' ? 'daily' : 'monthly', priority: p === '' ? 1 : p === '/cars' ? 0.9 : 0.5 })),
  ...cars.map((c) => ({ loc: `${base}/cars/${String(c.slug)}`, lastmod: iso(c.updatedAt ?? c.createdAt), freq: 'weekly', priority: 0.8 })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(u.loc)}</loc>${'lastmod' in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;

// Preview (demo) deploys are never indexed.
const robotsPath = resolve(root, 'dist', 'robots.txt');
const robots = demo ? 'User-agent: *\nDisallow: /\n' : `${readFileSync(robotsPath, 'utf8').trimEnd()}\n\nSitemap: ${base}/sitemap.xml\n`;

const dist = resolve(root, 'dist');
writeFileSync(resolve(dist, 'sitemap.xml'), xml);
writeFileSync(robotsPath, robots);
console.log(`sitemap.xml: ${urls.length} URLs (${base}); robots.txt${demo ? ' (demo: disallow all)' : ''}`);
