/**
 * Input schemas + output types for every callable Cloud Function.
 * The web wrapper (`apps/web/lib/functions.ts`) and the functions handlers both use `CallableMap`,
 * so names, inputs and outputs can never drift.
 */
import { z } from 'zod';
import {
  BOOKING_TYPES,
  CAR_STATUSES,
  type DEPOSIT_STATUSES,
  EXPENSE_CATEGORIES,
  MAX_TRADE_IN_PHOTOS,
  ROLES,
} from './constants';
import { customerSchema, zDateKey, zEmail, zId, zIsoDateTime, zName } from './schemas/common';
import { tradeInVehicleSchema } from './schemas/enquiry';

const turnstileToken = z.string().min(1, 'Please complete the verification');

// ---- Bookings ----------------------------------------------------------------
export const getAvailabilityInput = z.object({ carId: zId, date: zDateKey });
export interface GetAvailabilityOutput {
  date: string;
  timezone: string;
  /** ISO strings with zone offset, e.g. 2026-10-27T09:00:00+08:00 */
  slots: string[];
}

const bookingBase = z.object({
  carId: zId,
  type: z.enum(BOOKING_TYPES),
  startAt: zIsoDateTime,
  customer: customerSchema,
  licenceConfirmed: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().default(''),
});
const licenceRule = <T extends { type: string; licenceConfirmed: boolean }>(b: T) =>
  b.type !== 'test-drive' || b.licenceConfirmed;
const licenceRuleMsg = {
  message: 'Please confirm you hold a current driver licence',
  path: ['licenceConfirmed'],
};

export const createBookingInput = bookingBase
  .extend({ turnstileToken })
  .refine(licenceRule, licenceRuleMsg);
export interface CreateBookingOutput {
  bookingId: string;
  /** Raw manage token (also emailed). Used in /booking/[id]?t=token */
  manageToken: string;
  startAt: string;
  endAt: string;
}

export const cancelBookingInput = z.object({ bookingId: zId, token: z.string().min(16) });
export interface CancelBookingOutput {
  ok: true;
}

export const rescheduleBookingInput = z.object({
  bookingId: zId,
  token: z.string().min(16),
  startAt: zIsoDateTime,
});
export interface RescheduleBookingOutput {
  ok: true;
  startAt: string;
  endAt: string;
}

/** Customer view of a booking via manage link (added for /booking/[id]?t=token – see docs/DECISIONS.md). */
export const getManagedBookingInput = z.object({ bookingId: zId, token: z.string().min(16) });
export interface GetManagedBookingOutput {
  bookingId: string;
  carId: string;
  carTitle: string;
  carSlug: string | null;
  type: (typeof BOOKING_TYPES)[number];
  status: 'confirmed' | 'cancelled' | 'attended' | 'no-show';
  startAt: string;
  endAt: string;
  customer: { name: string; email: string; phone: string };
}

export const staffCreateBookingInput = bookingBase.refine(licenceRule, licenceRuleMsg);
export type StaffCreateBookingOutput = CreateBookingOutput;

// ---- Enquiries & trade-ins ---------------------------------------------------
export const createEnquiryInput = z
  .object({
    type: z.enum(['general', 'trade-in']),
    carId: zId.optional().nullable(),
    customer: customerSchema,
    message: z.string().trim().max(5000).default(''),
    tradeInVehicle: tradeInVehicleSchema.optional().nullable(),
    turnstileToken,
  })
  .refine((e) => e.type !== 'trade-in' || !!e.tradeInVehicle, {
    message: 'Vehicle details are required for a trade-in',
    path: ['tradeInVehicle'],
  })
  .refine((e) => e.type !== 'general' || e.message.length > 0, {
    message: 'Please enter a message',
    path: ['message'],
  });
export interface CreateEnquiryOutput {
  enquiryId: string;
}

export const getTradeInUploadUrlsInput = z.object({
  count: z.number().int().min(1).max(MAX_TRADE_IN_PHOTOS),
  turnstileToken,
});
export interface GetTradeInUploadUrlsOutput {
  uploads: { imageId: string; uploadURL: string }[];
}

// ---- Deposits ----------------------------------------------------------------
export const createDepositCheckoutInput = z.object({
  carId: zId,
  customer: customerSchema,
  termsAccepted: z.literal(true, { message: 'You must accept the non-refundable deposit terms' }),
  termsVersion: z.string().min(1),
  turnstileToken,
});
export interface CreateDepositCheckoutOutput {
  depositId: string;
  url: string;
}

export const getDepositStatusInput = z.object({ sessionId: z.string().min(1).max(255) });
export interface GetDepositStatusOutput {
  status: (typeof DEPOSIT_STATUSES)[number] | 'not-found';
  carTitle?: string;
  carSlug?: string | null;
  amountCents?: number;
}

// ---- Images ------------------------------------------------------------------
export const getImageUploadUrlInput = z.object({ carId: zId.optional() });
export interface GetImageUploadUrlOutput {
  imageId: string;
  uploadURL: string;
}

export const deleteCarImageInput = z.object({ carId: zId, imageId: z.string().min(1) });
export interface DeleteCarImageOutput {
  ok: true;
}

// ---- Exports -----------------------------------------------------------------
export const exportCarReportInput = z.object({ carId: zId });
export const exportStockReportInput = z
  .object({
    from: zDateKey,
    to: zDateKey,
    status: z.enum(CAR_STATUSES).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    format: z.enum(['xlsx', 'csv-stock', 'csv-expenses']).default('xlsx'),
  })
  .refine((v) => v.from <= v.to, { message: '"From" must be before "to"', path: ['to'] });
export interface ExportOutput {
  /** Signed URL valid for 15 minutes. */
  url: string;
  fileName: string;
  expiresAt: string;
}

// ---- Users -------------------------------------------------------------------
export const setUserRoleInput = z.object({ uid: zId, role: z.enum(ROLES) });
export const inviteUserInput = z.object({ email: zEmail, name: zName, role: z.enum(ROLES) });
export const deactivateUserInput = z.object({ uid: zId });
export interface SetUserRoleOutput {
  ok: true;
}
export interface InviteUserOutput {
  uid: string;
  /** Password-setup link (also emailed when Resend is configured; logged otherwise). */
  resetLink?: string;
}
export interface DeactivateUserOutput {
  ok: true;
}

// ---- Registry ----------------------------------------------------------------
export const callableSchemas = {
  getAvailability: getAvailabilityInput,
  createBooking: createBookingInput,
  cancelBooking: cancelBookingInput,
  rescheduleBooking: rescheduleBookingInput,
  getManagedBooking: getManagedBookingInput,
  staffCreateBooking: staffCreateBookingInput,
  createEnquiry: createEnquiryInput,
  getTradeInUploadUrls: getTradeInUploadUrlsInput,
  createDepositCheckout: createDepositCheckoutInput,
  getDepositStatus: getDepositStatusInput,
  getImageUploadUrl: getImageUploadUrlInput,
  deleteCarImage: deleteCarImageInput,
  exportCarReport: exportCarReportInput,
  exportStockReport: exportStockReportInput,
  setUserRole: setUserRoleInput,
  inviteUser: inviteUserInput,
  deactivateUser: deactivateUserInput,
} as const;

export type CallableName = keyof typeof callableSchemas;

export interface CallableOutputs {
  getAvailability: GetAvailabilityOutput;
  createBooking: CreateBookingOutput;
  cancelBooking: CancelBookingOutput;
  rescheduleBooking: RescheduleBookingOutput;
  getManagedBooking: GetManagedBookingOutput;
  staffCreateBooking: StaffCreateBookingOutput;
  createEnquiry: CreateEnquiryOutput;
  getTradeInUploadUrls: GetTradeInUploadUrlsOutput;
  createDepositCheckout: CreateDepositCheckoutOutput;
  getDepositStatus: GetDepositStatusOutput;
  getImageUploadUrl: GetImageUploadUrlOutput;
  deleteCarImage: DeleteCarImageOutput;
  exportCarReport: ExportOutput;
  exportStockReport: ExportOutput;
  setUserRole: SetUserRoleOutput;
  inviteUser: InviteUserOutput;
  deactivateUser: DeactivateUserOutput;
}

/** What the client sends (pre-defaults). */
export type CallableInput<N extends CallableName> = z.input<(typeof callableSchemas)[N]>;
/** What the handler receives after parsing. */
export type CallableParsedInput<N extends CallableName> = z.output<(typeof callableSchemas)[N]>;
export type CallableOutput<N extends CallableName> = CallableOutputs[N];

/** Access level per callable (for docs, admin menus and the functions role guard). */
export const CALLABLE_ACCESS: Record<CallableName, 'public' | 'staff' | 'admin'> = {
  getAvailability: 'public',
  createBooking: 'public',
  cancelBooking: 'public',
  rescheduleBooking: 'public',
  getManagedBooking: 'public',
  staffCreateBooking: 'staff',
  createEnquiry: 'public',
  getTradeInUploadUrls: 'public',
  createDepositCheckout: 'public',
  getDepositStatus: 'public',
  getImageUploadUrl: 'staff',
  deleteCarImage: 'staff',
  exportCarReport: 'admin',
  exportStockReport: 'admin',
  setUserRole: 'admin',
  inviteUser: 'admin',
  deactivateUser: 'admin',
};
