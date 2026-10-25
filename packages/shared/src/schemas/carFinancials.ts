import { z } from 'zod';
import { PURCHASE_SOURCES } from '../constants';
import { auditFieldsSchema, zCents, zDateKey, zTimestamp } from './common';

export const purchaseSourceSchema = z.enum(PURCHASE_SOURCES);

/** `carFinancials/{carId}` – admin only. Same id as the car. */
export const carFinancialsInputSchema = z.object({
  purchaseDate: zDateKey,
  /** Purchase price EXCLUDING GST. */
  purchasePriceCents: zCents,
  purchaseGstCents: zCents.default(0),
  source: purchaseSourceSchema,
  sellerName: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(5000).optional().default(''),
});
export type CarFinancialsInput = z.infer<typeof carFinancialsInputSchema>;
export type CarFinancialsFormValues = z.input<typeof carFinancialsInputSchema>;

export const carFinancialsSchema = carFinancialsInputSchema
  .omit({ purchaseDate: true })
  .extend({ purchaseDate: zTimestamp })
  .extend(auditFieldsSchema.shape);
export type CarFinancials = z.infer<typeof carFinancialsSchema>;
