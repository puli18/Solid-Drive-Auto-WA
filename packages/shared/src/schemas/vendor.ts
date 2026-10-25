import { z } from 'zod';
import { auditFieldsSchema, zEmail } from './common';

export const vendorInputSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  phone: z.string().trim().max(30).optional().default(''),
  email: zEmail.or(z.literal('')).optional().default(''),
  abn: z
    .string()
    .trim()
    .max(14)
    .refine((v) => v === '' || v.replace(/\s/g, '').length === 11, 'ABN must be 11 digits')
    .optional()
    .default(''),
});
export type VendorInput = z.infer<typeof vendorInputSchema>;
export type VendorFormValues = z.input<typeof vendorInputSchema>;

export const vendorSchema = vendorInputSchema.extend(auditFieldsSchema.shape);
export type Vendor = z.infer<typeof vendorSchema>;
