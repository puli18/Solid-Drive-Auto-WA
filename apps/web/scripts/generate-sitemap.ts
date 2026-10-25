/**
 * Build step (after `vite build`): writes dist/sitemap.xml and adds its absolute `Sitemap:` line to
 * dist/robots.txt (copied from public/robots.txt; demo builds disallow everything).
 * Car URLs come from the shared demo/seed fixtures (`@sda/shared/demo`) – the static host has no server
 * to query Firestore at request time (see docs/DECISIONS.md). Site URL: VITE_SITE_URL (.env* or shell).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDemoDataset } from '@sda/shared/demo';
import { loadEnv } from 'vite';
import { isPublicCar, sortNewestFirst } from '../lib/data/common';

const root = resolve(import.meta.dirname, '..');
const env = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const base = (env.VITE_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const demo = env.VITE_DEMO_MODE === 'true';

const STATIC = ['', '/cars', '/finance', '/trade-in', '/about', '/contact', '/warranty', '/faq', '/privacy', '/terms', '/deposit-terms'];

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : undefined);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const cars = sortNewestFirst((buildDemoDataset().cars as Record<string, unknown>[]).filter((c) => isPublicCar(c) && c.status !== 'sold'));
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
