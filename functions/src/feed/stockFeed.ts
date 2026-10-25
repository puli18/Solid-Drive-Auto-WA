import {
  BODY_TYPE_LABELS,
  carTitle,
  COLLECTIONS,
  FUEL_TYPE_LABELS,
  resolveImageUrl,
  sortCarImages,
  SYNDICATION_CHANNELS,
  TRANSMISSION_LABELS,
  type CarImage,
  type SyndicationChannel,
} from '@sda/shared';
import type { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { bindSecrets, db, env, REGION, siteUrl } from '../core';
import { safeEqual } from '../core/tokens';

export interface FeedItem {
  id: string;
  stockNo: string;
  title: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  bodyType: string;
  transmission: string;
  fuel: string;
  engine: string;
  colour: string;
  km: number;
  priceAud: number;
  description: string;
  features: string[];
  vin: string;
  url: string;
  images: string[];
  channels: SyndicationChannel[];
  updatedAt: string | null;
}

export function toFeedItem(id: string, d: Record<string, unknown>, base: string, delivery: string): FeedItem {
  const synd = (d.syndication ?? {}) as Record<string, boolean>;
  const images = sortCarImages((d.images as CarImage[]) ?? []).map((img) => {
    const url = resolveImageUrl(img.id, 'full', { deliveryUrl: delivery, localBase: `${base}/images` });
    return url.startsWith('/') ? `${base}${url}` : url;
  });
  return {
    id,
    stockNo: String(d.stockNo ?? ''),
    title: carTitle(d as { year: number; make: string; model: string; variant?: string }),
    make: String(d.make ?? ''),
    model: String(d.model ?? ''),
    variant: String(d.variant ?? ''),
    year: Number(d.year),
    bodyType: BODY_TYPE_LABELS[d.bodyType as keyof typeof BODY_TYPE_LABELS] ?? String(d.bodyType ?? ''),
    transmission: TRANSMISSION_LABELS[d.transmission as keyof typeof TRANSMISSION_LABELS] ?? String(d.transmission ?? ''),
    fuel: FUEL_TYPE_LABELS[d.fuel as keyof typeof FUEL_TYPE_LABELS] ?? String(d.fuel ?? ''),
    engine: String(d.engine ?? ''),
    colour: String(d.colour ?? ''),
    km: Number(d.km ?? 0),
    priceAud: Number(d.priceCents ?? 0) / 100,
    description: String(d.description ?? ''),
    features: (d.features as string[]) ?? [],
    vin: String(d.vin ?? ''),
    url: `${base}/cars/${String(d.slug ?? '')}`,
    images,
    channels: SYNDICATION_CHANNELS.filter((c) => synd[c] === true),
    updatedAt: (d.updatedAt as Timestamp | undefined)?.toDate?.().toISOString() ?? null,
  };
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function feedToXml(items: FeedItem[], generatedAt: Date): string {
  const el = (name: string, v: string | number) => `    <${name}>${xmlEscape(String(v))}</${name}>`;
  const body = items
    .map((i) =>
      [
        `  <listing id="${xmlEscape(i.id)}">`,
        el('stockNo', i.stockNo),
        el('title', i.title),
        el('make', i.make),
        el('model', i.model),
        el('variant', i.variant),
        el('year', i.year),
        el('bodyType', i.bodyType),
        el('transmission', i.transmission),
        el('fuel', i.fuel),
        el('engine', i.engine),
        el('colour', i.colour),
        el('odometerKm', i.km),
        `    <price currency="AUD">${i.priceAud.toFixed(2)}</price>`,
        el('vin', i.vin),
        el('url', i.url),
        el('description', i.description),
        `    <features>${i.features.map((f) => `<feature>${xmlEscape(f)}</feature>`).join('')}</features>`,
        `    <images>${i.images.map((u) => `<image>${xmlEscape(u)}</image>`).join('')}</images>`,
        `    <channels>${i.channels.map((c) => `<channel>${c}</channel>`).join('')}</channels>`,
        el('updatedAt', i.updatedAt ?? ''),
        '  </listing>',
      ].join('\n'),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<stockFeed generatedAt="${generatedAt.toISOString()}" count="${items.length}">\n${body}${body ? '\n' : ''}</stockFeed>\n`;
}

/**
 * Feed rows: published + available + not deleted + toggled for at least one channel (or the requested
 * channel). Read fresh on every request, so a sold car disappears on the next request.
 */
export async function loadFeedItems(channel?: SyndicationChannel): Promise<FeedItem[]> {
  const snap = await db.collection(COLLECTIONS.cars).where('published', '==', true).where('status', '==', 'available').get();
  const base = siteUrl();
  const delivery = env('CF_IMAGES_DELIVERY_URL');
  return snap.docs
    .filter((doc) => {
      const d = doc.data();
      if (d.deletedAt) return false;
      const s = (d.syndication ?? {}) as Record<string, boolean>;
      return channel ? s[channel] === true : SYNDICATION_CHANNELS.some((c) => s[c] === true);
    })
    .map((doc) => toFeedItem(doc.id, doc.data(), base, delivery))
    .sort((a, b) => a.stockNo.localeCompare(b.stockNo));
}

/**
 * stockFeed (M8, HTTPS) – generic JSON (default) or XML (`?format=xml`) listing feed for marketplaces.
 * Auth: `?key=` or `X-Feed-Key` header must equal STOCK_FEED_KEY (503 when no key is configured).
 * Optional `?channel=carsales|gumtree|facebook`.
 */
export const stockFeed = onRequest({ region: REGION, secrets: bindSecrets('STOCK_FEED_KEY') }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.set('Allow', 'GET, HEAD').status(405).json({ error: 'Method not allowed' });
    return;
  }
  const expected = env('STOCK_FEED_KEY');
  if (!expected) {
    logger.warn('[feed:not-configured] STOCK_FEED_KEY is not set');
    res.status(503).json({ error: 'Feed not configured' });
    return;
  }
  const given = String(req.header('x-feed-key') ?? req.query.key ?? '');
  if (!given || !safeEqual(given, expected)) {
    res.status(401).json({ error: 'Invalid feed key' });
    return;
  }
  const channelParam = typeof req.query.channel === 'string' ? req.query.channel : undefined;
  if (channelParam && !SYNDICATION_CHANNELS.includes(channelParam as SyndicationChannel)) {
    res.status(400).json({ error: `Unknown channel. Use one of: ${SYNDICATION_CHANNELS.join(', ')}` });
    return;
  }
  const items = await loadFeedItems(channelParam as SyndicationChannel | undefined);
  const now = new Date();
  logger.info(`stockFeed served ${items.length} listing(s)`, { channel: channelParam ?? 'all', format: req.query.format ?? 'json' });
  if (req.query.format === 'xml') {
    res.status(200).type('application/xml; charset=utf-8').send(feedToXml(items, now));
    return;
  }
  res.status(200).json({ generatedAt: now.toISOString(), count: items.length, listings: items });
});
