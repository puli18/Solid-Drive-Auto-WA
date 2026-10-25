import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '../constants';
import { auditFieldsSchema, zCents, zDateKey, zTimestamp } from './common';

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

/** `cars/{carId}/expenses/{expenseId}` input. totalCents = amountExGstCents + gstCents (refined). */
export const expenseFieldsSchema = z.object({
  date: zDateKey,
  category: expenseCategorySchema,
  description: z.string().trim().min(1, 'Required').max(500),
  vendorId: z.string().max(128).optional().nullable(),
  vendorName: z.string().trim().max(120).optional().default(''),
  invoiceNo: z.string().trim().max(60).optional().default(''),
  amountExGstCents: zCents,
  gstCents: zCents,
  totalCents: zCents,
  /** Firebase Storage path under receipts/{carId}/{expenseId}/… */
  receiptPath: z.string().max(500).optional().nullable(),
});

export const expenseInputSchema = expenseFieldsSchema.refine(
  (e) => e.amountExGstCents + e.gstCents === e.totalCents,
  {
    message: 'Total must equal amount ex GST + GST',
    path: ['totalCents'],
  },
);
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExpenseFormValues = z.input<typeof expenseInputSchema>;

export const expenseSchema = expenseFieldsSchema
  .omit({ date: true })
  .extend({
    date: zTimestamp,
    carId: z.string(),
    /** uid of the user who logged the expense. */
    loggedBy: z.string(),
  })
  .extend(auditFieldsSchema.shape);
export type Expense = z.infer<typeof expenseSchema>;
