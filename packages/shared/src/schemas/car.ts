import { z } from 'zod';
import { BODY_TYPES, CAR_STATUSES, FUEL_TYPES, MAX_CAR_PHOTOS, TRANSMISSIONS } from '../constants';
import { auditFieldsSchema, zCents, zDateKey, zTimestamp, zYear } from './common';

export const carStatusSchema = z.enum(CAR_STATUSES);
export const bodyTypeSchema = z.enum(BODY_TYPES);
export const fuelTypeSchema = z.enum(FUEL_TYPES);
export const transmissionSchema = z.enum(TRANSMISSIONS);

export const carImageSchema = z.object({
  /** Cloudflare Images id, or `local:cars/car-01.webp` for seed/dev images. */
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  isCover: z.boolean().default(false),
  alt: z.string().max(200).optional(),
});
export type CarImage = z.infer<typeof carImageSchema>;

export const syndicationSchema = z.object({
  carsales: z.boolean().default(false),
  gumtree: z.boolean().default(false),
  facebook: z.boolean().default(false),
});

/** Stock numbers: uppercase letters/digits, no hyphens (they end the slug). e.g. SDA1001 */
export const zStockNo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,16}$/, 'Letters and digits only, no spaces or hyphens');

/** Editable car fields (admin/staff car form). Dates are YYYY-MM-DD strings here. */
export const carInputSchema = z.object({
  stockNo: zStockNo,
  vin: z.string().trim().toUpperCase().max(17).optional().default(''),
  rego: z.string().trim().toUpperCase().max(10).optional().default(''),
  regoExpiry: zDateKey.optional().nullable(),
  make: z.string().trim().min(1, 'Required').max(40),
  model: z.string().trim().min(1, 'Required').max(60),
  variant: z.string().trim().max(80).optional().default(''),
  year: zYear,
  bodyType: bodyTypeSchema,
  transmission: transmissionSchema,
  fuel: fuelTypeSchema,
  engine: z.string().trim().max(60).optional().default(''),
  colour: z.string().trim().max(40).optional().default(''),
  km: z.number().int().nonnegative().max(2_000_000),
  features: z.array(z.string().trim().min(1).max(80)).max(80).default([]),
  description: z.string().trim().max(10_000).default(''),
  priceCents: zCents,
  status: carStatusSchema.default('draft'),
  published: z.boolean().default(false),
  images: z.array(carImageSchema).max(MAX_CAR_PHOTOS).default([]),
  syndication: syndicationSchema.default({ carsales: false, gumtree: false, facebook: false }),
});
export type CarInput = z.infer<typeof carInputSchema>;
export type CarFormValues = z.input<typeof carInputSchema>;

/** Stored `cars/{carId}` document. */
export const carSchema = carInputSchema
  .omit({ regoExpiry: true })
  .extend({
    slug: z.string(),
    regoExpiry: zTimestamp.nullable().optional(),
    soldAt: zTimestamp.nullable().optional(),
    reservedAt: zTimestamp.nullable().optional(),
    /** Denormalised for search: lowercase "make model variant stockNo rego". */
    searchText: z.string().optional(),
  })
  .extend(auditFieldsSchema.shape);
export type Car = z.infer<typeof carSchema>;

/** Public-safe projection used by SSR pages (dates serialised to ISO strings for RSC props). */
export const publicCarSchema = carSchema.pick({
  stockNo: true,
  slug: true,
  vin: true,
  rego: true,
  make: true,
  model: true,
  variant: true,
  year: true,
  bodyType: true,
  transmission: true,
  fuel: true,
  engine: true,
  colour: true,
  km: true,
  features: true,
  description: true,
  priceCents: true,
  status: true,
  published: true,
  images: true,
});
export type PublicCar = z.infer<typeof publicCarSchema> & {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  soldAt?: string | null;
  reservedAt?: string | null;
};
