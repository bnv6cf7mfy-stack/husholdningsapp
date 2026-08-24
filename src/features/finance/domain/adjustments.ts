// Pure adjustment/regulation logic (CPI, wage growth, interest, fixed percent,
// custom assumption series). No React/Supabase dependency.
import type { FinanceCashFlowDefinition } from "../types";

export type AdjustmentInput = Pick<
  FinanceCashFlowDefinition,
  | "adjustmentType"
  | "assumptionSeriesId"
  | "adjustmentMonth"
  | "adjustmentDay"
  | "marginRate"
  | "floorRate"
  | "capRate"
  | "applyInBaseYear"
  | "interestCalculationMode"
  | "principalAmount"
  | "validFrom"
>;

/** Looks up the assumption rate (as a decimal, e.g. 0.031 for 3.1 %) for a given series and period. */
export type AssumptionRateLookup = (assumptionSeriesId: string, periodStartIsoDate: string) => number | undefined;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultAdjustmentMonth(adjustmentType: AdjustmentInput["adjustmentType"]): number {
  return adjustmentType === "wage_growth" ? 8 : 1;
}

function clampRate(rate: number, floorRate: number | null, capRate: number | null): number {
  let result = rate;
  if (floorRate != null) result = Math.max(result, floorRate);
  if (capRate != null) result = Math.min(result, capRate);
  return result;
}

/** Calendar years (as period keys, "YYYY-01-01") whose regulation anniversary has occurred on or before occurrenceDate. */
function anniversaryPeriodsApplied(definition: AdjustmentInput, occurrenceDate: string): string[] {
  const baseYear = Number(definition.validFrom.slice(0, 4));
  const occurrenceYear = Number(occurrenceDate.slice(0, 4));
  const month = definition.adjustmentMonth ?? defaultAdjustmentMonth(definition.adjustmentType);
  const day = definition.adjustmentDay ?? 1;
  const periods: string[] = [];

  for (let year = baseYear; year <= occurrenceYear; year += 1) {
    if (year === baseYear && !definition.applyInBaseYear) continue;
    const anniversary = `${year}-${pad(month)}-${pad(day)}`;
    if (anniversary <= occurrenceDate) {
      periods.push(`${year}-01-01`);
    }
  }

  return periods;
}

/**
 * Applies the definition's adjustment rule to a base amount for a specific occurrence date.
 * Returns the adjusted (still unsigned, positive) amount.
 */
export function applyAdjustment(
  definition: AdjustmentInput,
  occurrenceDate: string,
  baseAmount: number,
  lookupRate: AssumptionRateLookup
): number {
  if (definition.adjustmentType === "none") {
    return baseAmount;
  }

  if (definition.adjustmentType === "interest_rate") {
    if (!definition.assumptionSeriesId) {
      return baseAmount;
    }

    const periodKey = `${occurrenceDate.slice(0, 4)}-01-01`;
    const rawRate = lookupRate(definition.assumptionSeriesId, periodKey) ?? 0;
    const effectiveRate = clampRate(rawRate + (definition.marginRate ?? 0), definition.floorRate, definition.capRate);

    if (definition.interestCalculationMode === "rate_on_principal") {
      const principal = definition.principalAmount ?? baseAmount;
      return principal * effectiveRate;
    }

    // percentage_of_amount
    return baseAmount * (1 + effectiveRate);
  }

  // cpi, wage_growth, fixed_annual_percent, custom_assumption: compounded per anniversary year.
  const periods = anniversaryPeriodsApplied(definition, occurrenceDate);
  let amount = baseAmount;

  for (const periodKey of periods) {
    const rawRate =
      definition.adjustmentType === "fixed_annual_percent"
        ? (definition.marginRate ?? 0)
        : definition.assumptionSeriesId
          ? (lookupRate(definition.assumptionSeriesId, periodKey) ?? 0)
          : 0;
    const effectiveRate = clampRate(rawRate, definition.floorRate, definition.capRate);
    amount *= 1 + effectiveRate;
  }

  return amount;
}
