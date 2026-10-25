import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants';
import { auditFieldsSchema, zCents, zDateKey, zEmail, zName, zPhone, zTimestamp } from './common';

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const buyerSchema = z.object({
  name: zName,
  address: z.string().trim().max(300).default(''),
  phone: zPhone,
  email: zEmail.or(z.literal('')).default(''),
  licenceNo: z.string().trim().max(30).default(''),
});

export const tradeInSchema = z.object({
  /** Draft car created for the trade-in (optional). */
  carId: z.string().nullable().optional(),
  valueCents: zCents,
  description: z.string().trim().max(200).optional().default(''),
});

/** `sales/{saleId}` input (sale form). Sale price EXCLUDING GST + GST stored separately. */
export const saleInputSchema = z.object({
  carId: z.string().min(1),
  stockNo: z.string().min(1),
  saleDate: zDateKey,
  salePriceCents: zCents,
  saleGstCents: zCents,
  buyer: buyerSchema,
  depositId: z.string().nullable().optional(),
  tradeIn: tradeInSchema.nullable().optional(),
  paymentMethod: paymentMethodSchema,
  financeCompany: z.string().trim().max(120).optional().default(''),
  warranty: z.string().trim().max(300).optional().default(''),
  deliveryDate: zDateKey.nullable().optional(),
  salespersonUid: z.string().min(1),
  /** Storage paths under sales/{saleId}/… */
  documents: z.array(z.string().max(500)).max(30).default([]),
  notes: z.string().trim().max(5000).optional().default(''),
});
export type SaleInput = z.infer<typeof saleInputSchema>;
export type SaleFormValues = z.input<typeof saleInputSchema>;

export const saleSchema = saleInputSchema
  .omit({ saleDate: true, deliveryDate: true })
  .extend({
    saleDate: zTimestamp,
    deliveryDate: zTimestamp.nullable().optional(),
  })
  .extend(auditFieldsSchema.shape);
export type Sale = z.infer<typeof saleSchema>;
