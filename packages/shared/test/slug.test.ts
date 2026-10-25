import { describe, expect, it } from 'vitest';
import { carSlug, carTitle, slugify, stockNoFromSlug } from '../src/slug';

describe('slug', () => {
  it('builds {year}-{make}-{model}-{variant}-{stockNo}', () => {
    expect(carSlug({ year: 2021, make: 'Toyota', model: 'Hilux', variant: 'SR5 4x4', stockNo: 'SDA1001' })).toBe(
      '2021-toyota-hilux-sr5-4x4-sda1001',
    );
  });
  it('drops empty variants and normalises punctuation/accents', () => {
    expect(carSlug({ year: 2019, make: 'Mercedes-Benz', model: 'C 200', variant: '', stockNo: 'A12' })).toBe(
      '2019-mercedes-benz-c-200-a12',
    );
    expect(slugify('  Škoda  Octavia RS / 245 ')).toBe('skoda-octavia-rs-245');
    expect(slugify('Ford Ranger XLT (Hi-Rider) & Tow')).toBe('ford-ranger-xlt-hi-rider-and-tow');
  });
  it('recovers the stock number and builds titles', () => {
    expect(stockNoFromSlug('2021-toyota-hilux-sr5-sda1001')).toBe('SDA1001');
    expect(carTitle({ year: 2021, make: 'Toyota', model: 'Hilux', variant: 'SR5' })).toBe('2021 Toyota Hilux SR5');
  });
});
