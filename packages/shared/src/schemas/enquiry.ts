import { z } from 'zod';
import {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  MAX_TRADE_IN_PHOTOS,
  TRADE_IN_CONDITIONS,
} from '../constants';
import { auditFieldsSchema, customerSchema, zTimestamp, zYear } from './common';

export const enquiryTypeSchema = z.enum(ENQUIRY_TYPES);
export const enquiryStatusSchema = z.enum(ENQUIRY_STATUSES);
export const tradeInConditionSchema = z.enum(TRADE_IN_CONDITIONS);

export const tradeInVehicleSchema = z.object({
  rego: z.string().trim().toUpperCase().max(10).default(''),
  make: z.string().trim().min(1, 'Required').max(40),
  model: z.string().trim().min(1, 'Required').max(60),
  year: zYear,
  km: z.number().int().nonnegative().max(2_000_000),
  condition: tradeInConditionSchema,
  /** Cloudflare image ids (trade-in/ prefix) from getTradeInUploadUrls. */
  images: z.array(z.string()).max(MAX_TRADE_IN_PHOTOS).default([]),
});
export type TradeInVehicle = z.infer<typeof tradeInVehicleSchema>;

export const enquiryNoteSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  by: z.string(),
  at: zTimestamp,
});
export type EnquiryNote = z.infer<typeof enquiryNoteSchema>;

/** Stored `enquiries/{enquiryId}` (created only by createEnquiry). */
export const enquirySchema = z
  .object({
    type: enquiryTypeSchema,
    carId: z.string().nullable().optional(),
    carTitle: z.string().optional(),
    customer: customerSchema,
    message: z.string().max(5000).default(''),
    tradeInVehicle: tradeInVehicleSchema.nullable().optional(),
    status: enquiryStatusSchema,
    assignedTo: z.string().nullable().optional(),
    notes: z.array(enquiryNoteSchema).default([]),
    bookingId: z.string().nullable().optional(),
  })
  .extend(auditFieldsSchema.shape);
export type Enquiry = z.infer<typeof enquirySchema>;

/** Fields admin/staff may change directly (rules enforce the same list). */
export const enquiryStaffUpdateSchema = z.object({
  status: enquiryStatusSchema.optional(),
  assignedTo: z.string().nullable().optional(),
  bookingId: z.string().nullable().optional(),
});
export const ENQUIRY_STAFF_EDITABLE_FIELDS = [
  'status',
  'assignedTo',
  'notes',
  'bookingId',
  'updatedAt',
  'updatedBy',
] as const;
