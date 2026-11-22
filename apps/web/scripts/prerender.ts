/**
 * Build step (after `vite build`). The site is a client-rendered SPA, so without this every URL would send
 * the same empty index.html to search engines. It writes:
 *  - dist/<route>.html for every public page and every published car (Cloudflare Pages serves
 *    dist/cars/x.html at /cars/x): the page's own title, description, canonical, Open Graph tags and
 *    schema.org JSON-LD in <head>, plus a plain-HTML snapshot of the content inside #root that React
 *    replaces on load (createRoot, not hydrate). Head tags carry `data-sda-meta`, so the app's own
 *    document-meta code replaces them on client navigation instead of duplicating them.
 *  - dist/spa/index.html: the untouched SPA shell, which public/_redirects serves for the app-only routes
 *    (admin, booking, reserve). Any other unknown URL (e.g. a car added since the last build) gets Pages'
 *    built-in SPA fallback, dist/index.html, so the home page's raw HTML carries no canonical tag or
 *    structured data (the app sets both once it runs). A catch-all `/* … 200` rewrite is not an option:
 *    Pages applies rewrites before static files, so it would hide the pre-rendered pages.
 *  - dist/sitemap.xml and dist/robots.txt (with its Sitemap line; non-indexable builds disallow everything).
 *
 * Page metadata comes from the route modules themselves (`metadata` / `meta()`), loaded through Vite's SSR
 * module loader so import.meta.env matches the build. Cars come from Firestore at build time (unauthenticated
 * REST runQuery of published cars, allowed by the public-read rules) when a real project is configured;
 * otherwise, or if the read fails, only the static pages are written. Cars added later still work through
 * the SPA fallback (and are picked up by the next build).
 *
 * `--mode <mode>` picks the Vite env files (default production; build:preview passes preview).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer, loadEnv } from 'vite';
import { carTitle, DEFAULT_BOOKING_SETTINGS, DEFAULT_BUSINESS_SETTINGS, type PublicCar, resolveImageUrl, sortCarImages } from '@sda/shared';
import { isPublicCar, sortNewestFirst, toPublicCar } from '../lib/data/common';
import { breadcrumbJsonLd, carJsonLd, carSeo, dealerJsonLd } from '../components/site/lib/seo';
import {
  bodyLabel,
  carName,
  formatKm,
  formatPrice,
  formatYear,
  fuelLabel,
  hoursRows,
  paragraphs,
  telHref,
  transmissionLabel,
} from '../components/site/lib/format';
import type { Metadata } from '../lib/meta';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const modeArg = process.argv.indexOf('--mode');
const mode = modeArg > -1 ? (process.argv[modeArg + 1] ?? 'production') : 'production';
const env = { ...loadEnv(mode, root, 'VITE_'), ...process.env };
const base = (env.VITE_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const indexable = env.VITE_DEMO_MODE !== 'true' || env.VITE_ALLOW_INDEXING === 'true';
const business = DEFAULT_BUSINESS_SETTINGS;
const SUFFIX = ' | Solid Drive Auto WA';

/** Public pages: path → route module (under app/(site)). */
const PAGES: { path: string; module: string; freq: string; priority: number }[] = [
  { path: '/', module: 'page', freq: 'daily', priority: 1 },
  { path: '/cars', module: 'cars/page', freq: 'daily', priority: 0.9 },
  { path: '/finance', module: 'finance/page', freq: 'monthly', priority: 0.5 },
  { path: '/trade-in', module: 'trade-in/page', freq: 'monthly', priority: 0.6 },
  { path: '/about', module: 'about/page', freq: 'monthly', priority: 0.5 },
  { path: '/contact', module: 'contact/page', freq: 'monthly', priority: 0.7 },
  { path: '/warranty', module: 'warranty/page', freq: 'monthly', priority: 0.4 },
  { path: '/faq', module: 'faq/page', freq: 'monthly', priority: 0.4 },
  { path: '/privacy', module: 'privacy/page', freq: 'yearly', priority: 0.2 },
  { path: '/terms', module: 'terms/page', freq: 'yearly', priority: 0.2 },
  { path: '/deposit-terms', module: 'deposit-terms/page', freq: 'yearly', priority: 0.2 },
];

// ---------------------------------------------------------------- Firestore (REST)

type FsValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FsValue> };
  arrayValue?: { values?: FsValue[] };
};

function fromFs(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return new Date(v.timestampValue!);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue?.fields ?? {}).map(([k, x]) => [k, fromFs(x)]));
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(fromFs);
  return null;
}

/** Published cars, as full documents. */
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
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
  return rows.flatMap((r) =>
    r.document?.fields ? [{ id: r.document.name.split('/').pop(), ...(fromFs({ mapValue: { fields: r.document.fields } }) as object) }] : [],
  );
}

let docs: Record<string, unknown>[] = [];
try {
  docs = await publishedCars();
} catch (err) {
  console.warn(`prerender: could not read cars from Firestore (${err instanceof Error ? err.message : String(err)}); static pages only`);
}
const cars: PublicCar[] = sortNewestFirst(docs.filter((c) => isPublicCar(c) && c.status !== 'sold')).map((d) => toPublicCar(d));

// ---------------------------------------------------------------- HTML

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (url: string) => (/^https?:/.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`);
const imageUrl = (id: string) => abs(resolveImageUrl(id, 'full', { deliveryUrl: env.VITE_CF_IMAGES_DELIVERY_URL ?? '', localBase: '/images' }));
const ld = (data: object) => `<script type="application/ld+json" data-sda-meta>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const titleOf = (m: Metadata) => (typeof m.title === 'object' ? m.title.absolute : m.title ? `${m.title}${SUFFIX}` : 'Solid Drive Auto WA – Quality used cars in Perth');

function head(m: Metadata, path: string, jsonLd: object[]): string {
  const title = titleOf(m);
  const description = m.description ?? '';
  const image = abs(m.openGraph?.images?.[0]?.url ?? '/images/og/default.webp');
  const tag = (attrs: Record<string, string>, el = 'meta') =>
    `<${el} ${Object.entries(attrs)
      .map(([k, v]) => `${k}="${esc(v)}"`)
      .join(' ')} data-sda-meta />`;
  return [
    // The home page doubles as Pages' SPA fallback for unknown URLs, so it can't claim a canonical URL here.
    ...(path === '/' ? [] : [tag({ rel: 'canonical', href: abs(path) }, 'link')]),
    tag({ property: 'og:type', content: m.openGraph?.type ?? 'website' }),
    tag({ property: 'og:title', content: m.openGraph?.title ?? title }),
    tag({ property: 'og:description', content: description }),
    tag({ property: 'og:url', content: abs(path) }),
    tag({ property: 'og:image', content: image }),
    tag({ property: 'og:site_name', content: 'Solid Drive Auto WA' }),
    tag({ property: 'og:locale', content: 'en_AU' }),
    tag({ name: 'twitter:card', content: 'summary_large_image' }),
    ...jsonLd.map(ld),
  ]
    .map((l) => `    ${l}`)
    .join('\n');
}

const NAV = [
  ['/', 'Home'],
  ['/cars', 'Cars for sale'],
  ['/finance', 'Finance'],
  ['/trade-in', 'Trade-in'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/faq', 'FAQ'],
];

function shell(main: string): string {
  const a = business.address;
  return `<div class="sda-ssg">
      <header><a href="/"><strong>Solid Drive Auto WA</strong></a><nav>${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join(' ')}</nav></header>
      <main>${main}</main>
      <footer>
        <p><strong>${esc(business.name)}</strong> · Licensed motor vehicle dealer ${esc(business.dealerLicenceNo)}</p>
        <address>${esc(a.line1)}, ${esc(a.suburb)} ${esc(a.state)} ${esc(a.postcode)}</address>
        <p><a href="${telHref(business.phone)}">${esc(business.phone)}</a> · ${hoursRows(business.hours).map(esc).join(' · ')}</p>
      </footer>
    </div>`;
}

function carList(list: PublicCar[]): string {
  if (!list.length) return '<p>New stock is on its way. Call us to ask about what’s coming in.</p>';
  return `<ul>${list
    .map((c) => {
      const cover = sortCarImages(c.images ?? [])[0];
      const img = cover ? `<img src="${esc(imageUrl(cover.id))}" alt="${esc(carTitle(c))}" width="400" height="300" loading="lazy" />` : '';
      const km = c.km > 0 ? ` · ${esc(formatKm(c.km))}` : '';
      return `<li><a href="/cars/${esc(c.slug)}">${img}<span>${esc(carName(c))}${c.variant ? ` ${esc(c.variant)}` : ''}</span></a> ${esc(formatPrice(c.priceCents))}${km} · ${esc(transmissionLabel(c.transmission))} · ${esc(fuelLabel(c.fuel))}</li>`;
    })
    .join('')}</ul>`;
}

function carMain(c: PublicCar): string {
  const images = sortCarImages(c.images ?? []);
  const specs: [string, string][] = [
    ['Year', formatYear(c.year)],
    ['Make', c.make],
    ['Model', c.model],
    ['Variant', c.variant || '—'],
    ['Body', bodyLabel(c.bodyType)],
    ['Odometer', formatKm(c.km)],
    ['Transmission', transmissionLabel(c.transmission)],
    ['Fuel', fuelLabel(c.fuel)],
    ['Engine', c.engine || '—'],
    ['Colour', c.colour || '—'],
    ['Stock no', c.stockNo],
  ];
  return `<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/cars">Cars for sale</a></nav>
        <h1>${esc(carName(c))}</h1>
        ${c.variant ? `<p>${esc(c.variant)}</p>` : ''}
        <p><strong>${esc(formatPrice(c.priceCents))}</strong></p>
        ${images
          .slice(0, 1)
          .map((i, n) => `<img src="${esc(imageUrl(i.id))}" alt="${esc(i.alt || `${carTitle(c)} – photo ${n + 1}`)}" width="800" height="600" />`)
          .join('')}
        <p><a href="${telHref(business.phone)}">Call ${esc(business.phone)}</a> to book a test drive.</p>
        ${c.description ? `<h2>About this car</h2>${paragraphs(c.description).map((p) => `<p>${esc(p)}</p>`).join('')}` : ''}
        <h2>Specifications</h2>
        <dl>${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${c.features?.length ? `<h2>Features</h2><ul>${c.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        <p><a href="/cars">See all cars for sale</a></p>`;
}

const STYLE = `<style data-sda-ssg>.sda-ssg{font:16px/1.5 system-ui,sans-serif;background:#0a0a0b;color:#f4f5f7;min-height:100vh;padding:24px 16px}.sda-ssg a{color:inherit}.sda-ssg nav a{margin-right:12px}.sda-ssg main{max-width:72rem;margin:32px auto}.sda-ssg img{max-width:100%;height:auto;display:block}.sda-ssg ul{list-style:none;padding:0}.sda-ssg li{margin:0 0 24px}.sda-ssg footer{max-width:72rem;margin:0 auto;color:#c9ccd1;font-size:14px}</style>`;

const template = readFileSync(resolve(dist, 'index.html'), 'utf8');
// Plain shell for the app-only routes (public/_redirects).
mkdirSync(resolve(dist, 'spa'), { recursive: true });
writeFileSync(resolve(dist, 'spa', 'index.html'), template);

function writePage(path: string, m: Metadata, jsonLd: object[], main: string) {
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(titleOf(m))}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(m.description ?? '')}" />`)
    .replace('</head>', `${head(m, path, jsonLd)}\n    ${STYLE}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${shell(main)}</div>`);
  if (!indexable) html = html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>');
  const file = path === '/' ? resolve(dist, 'index.html') : resolve(dist, `${path.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ---------------------------------------------------------------- pages

const vite = await createServer({ root, mode, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false } });
try {
  const dealer = dealerJsonLd(business, DEFAULT_BOOKING_SETTINGS.weeklyHours, base);
  for (const p of PAGES) {
    const mod = (await vite.ssrLoadModule(`/app/(site)/${p.module}.tsx`)) as { metadata?: Metadata };
    const m = mod.metadata ?? {};
    const h1 = typeof m.title === 'object' ? m.title.absolute : (m.title ?? 'Solid Drive Auto WA');
    const main =
      p.path === '/'
        ? `<h1>Quality used cars in Perth</h1><p>${esc(m.description ?? '')}</p><h2>Cars for sale now</h2>${carList(cars)}`
        : p.path === '/cars'
          ? `<h1>${esc(h1)}</h1><p>${esc(m.description ?? '')}</p>${carList(cars)}`
          : `<h1>${esc(h1)}</h1><p>${esc(m.description ?? '')}</p>`;
    const jsonLd = p.path === '/contact' ? [dealer] : [];
    writePage(p.path, m, jsonLd, main);
  }

  const carModule = (await vite.ssrLoadModule('/app/(site)/cars/[slug]/page.tsx')) as { meta: (d: { car: PublicCar }) => Metadata };
  for (const car of cars) {
    const { name, path } = carSeo(car, base, imageUrl);
    writePage(path, carModule.meta({ car }), [
      carJsonLd(car, business, base, imageUrl),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Cars for sale', path: '/cars' }, { name, path }], base),
    ], carMain(car));
  }
} finally {
  await vite.close();
}

// ---------------------------------------------------------------- sitemap + robots

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : undefined);
const urls = [
  ...PAGES.map((p) => ({ loc: `${base}${p.path}`, lastmod: undefined as string | undefined, freq: p.freq, priority: p.priority })),
  ...cars.map((c) => ({ loc: `${base}/cars/${c.slug}`, lastmod: iso(c.updatedAt ?? c.createdAt), freq: 'weekly', priority: 0.8 })),
];
writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`,
);

const robotsPath = resolve(dist, 'robots.txt');
writeFileSync(robotsPath, indexable ? `${readFileSync(robotsPath, 'utf8').trimEnd()}\n\nSitemap: ${base}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');

console.log(`prerender: ${PAGES.length} pages + ${cars.length} cars → dist/*.html; sitemap.xml ${urls.length} URLs (${base}); robots.txt ${indexable ? 'allows indexing' : 'disallows all'}`);
