/**
 * Search metadata and schema.org JSON-LD for the public site. Pure (no import.meta.env, no DOM), so the
 * pages and the build-time prerender (scripts/prerender.ts) produce the same titles, descriptions and
 * structured data. URLs are made absolute against the `siteUrl` passed in.
 */
import { carTitle, sortCarImages, type PublicCar, WEEKDAYS } from '@sda/shared';
import { bodyLabel, formatKm, formatPrice, fuelLabel, hasPrice, transmissionLabel } from './format';

type Business = {
  name: string;
  phone: string;
  email: string;
  abn?: string;
  dealerLicenceNo?: string;
  address: { line1: string; line2?: string; suburb: string; state: string; postcode: string };
};
type WeeklyHours = Partial<Record<(typeof WEEKDAYS)[number], readonly { start: string; end: string }[]>>;
/** Absolute image URL for a car image id (the caller knows the image host). */
export type ImageUrl = (id: string) => string;

const SCHEMA_DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' } as const;

/** Placeholder contact details (e.g. `sales@soliddrive.test`, ABN `00 000 000 000`) are never published. */
export const isRealEmail = (email: string | undefined) => !!email && !/\.(test|example|invalid|localhost)$/i.test(email);
export const isRealAbn = (abn: string | undefined) => !!abn && /[1-9]/.test(abn);

export function carSeo(car: PublicCar, siteUrl: string, imageUrl: ImageUrl) {
  const name = carTitle(car);
  const title = `${name} – ${formatPrice(car.priceCents)}`;
  const km = car.km > 0 ? `${formatKm(car.km)}, ` : '';
  const description = `${name} for sale in Perth: ${km}${transmissionLabel(car.transmission).toLowerCase()}, ${fuelLabel(car.fuel).toLowerCase()}. Stock no ${car.stockNo}. Book a test drive online.`;
  const cover = sortCarImages(car.images ?? [])[0];
  return {
    name,
    title,
    description,
    path: `/cars/${car.slug}`,
    image: cover ? imageUrl(cover.id) : `${siteUrl}/images/og/default.webp`,
  };
}

export function postalAddress(b: Business) {
  return {
    '@type': 'PostalAddress',
    streetAddress: [b.address.line1, b.address.line2].filter(Boolean).join(', '),
    addressLocality: b.address.suburb,
    addressRegion: b.address.state,
    postalCode: b.address.postcode,
    addressCountry: 'AU',
  };
}

/** The dealership as a schema.org AutoDealer (local business: name, address, phone, hours). */
export function dealerJsonLd(b: Business, weeklyHours: WeeklyHours, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': `${siteUrl}/#dealer`,
    name: b.name,
    url: siteUrl,
    logo: `${siteUrl}/icon.png`,
    image: `${siteUrl}/images/og/default.webp`,
    telephone: b.phone,
    email: isRealEmail(b.email) ? b.email : undefined,
    priceRange: '$$',
    areaServed: { '@type': 'City', name: 'Perth' },
    // Structured hours from the booking rules (weekly open ranges); the display text is b.hours.
    openingHoursSpecification: WEEKDAYS.flatMap((d) =>
      (weeklyHours[d] ?? []).map((r) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${SCHEMA_DAY[d]}`,
        opens: r.start,
        closes: r.end,
      })),
    ),
    address: postalAddress(b),
  };
}

export function carJsonLd(car: PublicCar, b: Business, siteUrl: string, imageUrl: ImageUrl) {
  const url = `${siteUrl}/cars/${car.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: carTitle(car),
    url,
    image: sortCarImages(car.images ?? []).map((i) => imageUrl(i.id)),
    brand: { '@type': 'Brand', name: car.make },
    model: car.model,
    vehicleConfiguration: car.variant || undefined,
    vehicleModelDate: car.year > 0 ? String(car.year) : undefined,
    bodyType: bodyLabel(car.bodyType),
    color: car.colour || undefined,
    fuelType: fuelLabel(car.fuel),
    vehicleTransmission: transmissionLabel(car.transmission),
    vehicleEngine: car.engine ? { '@type': 'EngineSpecification', name: car.engine } : undefined,
    vehicleIdentificationNumber: car.vin || undefined,
    mileageFromOdometer: car.km > 0 ? { '@type': 'QuantitativeValue', value: car.km, unitCode: 'KMT' } : undefined,
    itemCondition: 'https://schema.org/UsedCondition',
    sku: car.stockNo,
    description: car.description || undefined,
    offers: {
      '@type': 'Offer',
      // Price on application: no price in the structured data.
      ...(hasPrice(car) ? { price: (car.priceCents / 100).toFixed(2), priceCurrency: 'AUD' } : {}),
      url,
      itemCondition: 'https://schema.org/UsedCondition',
      availability:
        car.status === 'available'
          ? 'https://schema.org/InStock'
          : car.status === 'reserved'
            ? 'https://schema.org/LimitedAvailability'
            : 'https://schema.org/SoldOut',
      seller: { '@type': 'AutoDealer', '@id': `${siteUrl}/#dealer`, name: b.name, telephone: b.phone, address: postalAddress(b) },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${siteUrl}${it.path}` })),
  };
}
