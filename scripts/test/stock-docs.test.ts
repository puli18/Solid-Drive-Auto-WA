import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carSlug } from '@sda/shared';
import { STOCK_CARS } from '../data/stock';
import {
  buildStockCarDocs,
  buildStockSettingsDocs,
  localImageId,
  nextStockNoAfter,
  SEED_STOCK_ACTOR,
  stockCarId,
  validateCarDoc,
  validateSettingsDoc,
} from '../lib/stock-docs';

const now = new Date('2026-11-03T02:00:00Z');

describe('buildStockCarDocs', () => {
  const docs = buildStockCarDocs({ now });

  it('builds the three stock cars with deterministic ids, slugs and seed audit fields', () => {
    expect(docs.map((d) => d.id)).toEqual(['car-sda1001', 'car-sda1002', 'car-sda1003']);
    expect(docs.map((d) => d.slug)).toEqual(['2012-mazda-mazda3-sda1001', 'nissan-patrol-dx-crd-4x4-sda1002', '2007-mitsubishi-lancer-es-sda1003']);
    for (const d of docs) {
      expect(d).toMatchObject({ createdBy: SEED_STOCK_ACTOR, updatedBy: SEED_STOCK_ACTOR, deletedAt: null, published: true, status: 'available' });
      expect(d.createdAt).toBeInstanceOf(Date);
    }
    // Newest first = Lancer (listed 1 day ago), then Patrol, then Mazda3.
    const t = (id: string) => (docs.find((d) => d.id === id)!.createdAt as Date).getTime();
    expect(t('car-sda1003')).toBeGreaterThan(t('car-sda1002'));
    expect(t('car-sda1002')).toBeGreaterThan(t('car-sda1001'));
  });

  it('is deterministic for the same `now`', () => {
    expect(buildStockCarDocs({ now })).toEqual(docs);
  });

  it('passes the stored car schema (Patrol year/km/price 0 = not supplied yet)', () => {
    for (const d of docs) expect(validateCarDoc(d), String(d.id)).toEqual([]);
    expect(docs.find((d) => d.id === 'car-sda1002')).toMatchObject({ year: 0, km: 0, priceCents: 0 });
    expect(docs.find((d) => d.id === 'car-sda1001')).toMatchObject({ priceCents: 599_000, km: 225_000 });
  });

  it('reports schema issues', () => {
    const bad = { ...docs[0]!, priceCents: -1, make: '' };
    expect(validateCarDoc(bad).join('\n')).toMatch(/priceCents[\s\S]*make|make[\s\S]*priceCents/);
  });

  it('uses local:cars photo ids with the cover first, unless an image id override is given', () => {
    for (const [i, d] of docs.entries()) {
      const fx = STOCK_CARS[i]!;
      const images = d.images as { id: string; order: number; isCover: boolean; alt: string }[];
      expect(images).toHaveLength(fx.photos.length);
      expect(images[0]).toMatchObject({ id: localImageId(fx.photoKey, '01.webp'), order: 0, isCover: true });
      expect(images.filter((im) => im.isCover)).toHaveLength(1);
      for (const im of images) expect(im.alt.length).toBeGreaterThan(0);
    }
    const uploaded = buildStockCarDocs({ now, imageId: (_c, carId, file) => `https://example.test/${carId}/${file}` });
    expect((uploaded[0]!.images as { id: string }[])[0]!.id).toBe('https://example.test/car-sda1001/01.webp');
    expect(validateCarDoc(uploaded[0]!)).toEqual([]);
  });

  it('every photo exists as a static site asset', () => {
    const dir = resolve(__dirname, '../../apps/web/public/images/cars');
    for (const c of STOCK_CARS) for (const p of c.photos) expect(existsSync(resolve(dir, c.photoKey, p.file)), `${c.photoKey}/${p.file}`).toBe(true);
  });

  it('keeps the slug helper and stock numbers consistent', () => {
    for (const c of STOCK_CARS) expect(stockCarId(c.stockNo)).toBe(`car-${c.stockNo.toLowerCase()}`);
    expect(new Set(STOCK_CARS.map((c) => carSlug(c))).size).toBe(STOCK_CARS.length);
  });
});

describe('buildStockSettingsDocs', () => {
  it('builds valid settings from the shared defaults with nextStockNo after the stock', () => {
    const s = buildStockSettingsDocs({ now });
    expect(nextStockNoAfter()).toBe(1004);
    expect(s.app.nextStockNo).toBe(1004);
    expect(s.business).toMatchObject({ dealerLicenceNo: 'MD33297', phone: '0451 847 563', updatedBy: SEED_STOCK_ACTOR });
    for (const id of ['business', 'booking', 'deposit', 'finance', 'legal', 'app'] as const) {
      expect(validateSettingsDoc(id, s[id]), id).toEqual([]);
    }
  });
});
