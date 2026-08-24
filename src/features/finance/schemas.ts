// Zod validation schemas for Finance mutations. Used server-side (source of
// truth) and can be reused client-side for optimistic form validation.
import { z } from "zod";

export const financeAccountTypeSchema = z.enum(["checking", "buffer", "savings", "other"]);

export const createFinanceAccountSchema = z.object({
  name: z.string().trim().min(1).max(160),
  accountType: financeAccountTypeSchema,
  ownerMemberId: z.string().uuid().nullable().optional(),
  currency: z.string().trim().length(3).default("NOK"),
  maskedIdentifier: z.string().trim().max(40).nullable().optional(),
  paymentEnabled: z.boolean().default(true),
  drawPriority: z.number().int().min(0).max(100).default(0),
  minimumBalance: z.number().min(0).nullable().optional()
});

export const addFinanceBalanceSnapshotSchema = z.object({
  accountId: z.string().uuid(),
  balanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato"),
  balance: z.number()
});

export const financeCashFlowTypeSchema = z.enum(["income", "expense"]);
export const financeRecurrenceTypeSchema = z.enum(["once", "monthly", "quarterly", "annual", "specific_dates"]);
export const financeAdjustmentTypeSchema = z.enum([
  "none",
  "cpi",
  "wage_growth",
  "interest_rate",
  "fixed_annual_percent",
  "custom_assumption"
]);

export const createFinanceCashFlowSchema = z
  .object({
    cashFlowType: financeCashFlowTypeSchema,
    categoryId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    baseAmount: z.number().min(0),
    ownerMemberId: z.string().uuid().nullable().optional(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato"),
    validTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato")
      .nullable()
      .optional(),
    recurrenceType: financeRecurrenceTypeSchema,
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
    quarterStartMonth: z.number().int().min(1).max(3).nullable().optional(),
    specificDates: z
      .array(
        z.object({
          occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato"),
          amountMultiplier: z.number().positive().default(1),
          amountOverride: z.number().min(0).nullable().optional()
        })
      )
      .default([]),
    adjustmentType: financeAdjustmentTypeSchema.default("none"),
    assumptionSeriesId: z.string().uuid().nullable().optional(),
    fixedAnnualPercent: z.number().nullable().optional(),
    marginRate: z.number().nullable().optional(),
    floorRate: z.number().nullable().optional(),
    capRate: z.number().nullable().optional(),
    applyInBaseYear: z.boolean().default(false)
  })
  .refine((value) => value.recurrenceType !== "monthly" || value.dayOfMonth != null, {
    message: "Månedlig gjentakelse krever dag i måneden",
    path: ["dayOfMonth"]
  })
  .refine((value) => value.recurrenceType !== "annual" || (value.dayOfMonth != null && value.monthOfYear != null), {
    message: "Årlig gjentakelse krever måned og dag",
    path: ["monthOfYear"]
  })
  .refine((value) => value.recurrenceType !== "specific_dates" || value.specificDates.length > 0, {
    message: "Spesifikke datoer krever minst én dato",
    path: ["specificDates"]
  });

export const reviseFinanceCashFlowSchema = z.object({
  seriesId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato"),
  baseAmount: z.number().min(0)
});

export type CreateFinanceAccountInput = z.infer<typeof createFinanceAccountSchema>;
export type AddFinanceBalanceSnapshotInput = z.infer<typeof addFinanceBalanceSnapshotSchema>;
export type CreateFinanceCashFlowInput = z.infer<typeof createFinanceCashFlowSchema>;
export type ReviseFinanceCashFlowInput = z.infer<typeof reviseFinanceCashFlowSchema>;
