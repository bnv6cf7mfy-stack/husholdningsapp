// Shared TypeScript types for the Finance bounded context.
// Mirrors supabase/migrations/202608240001_finance_domain.sql (snake_case in DB, camelCase here).

export type FinanceCashFlowScope = "income" | "expense" | "both";
export type FinanceAccountType = "checking" | "buffer" | "savings" | "other";
export type FinanceBalanceSource = "manual" | "bank_import";
export type FinanceAssumptionSeriesType = "cpi" | "wage_growth" | "interest_rate" | "custom";
export type FinanceAssumptionFrequency = "monthly" | "quarterly" | "annual";
export type FinanceAssumptionValueStatus = "actual" | "forecast" | "manual";
export type FinanceCashFlowType = "income" | "expense";
export type FinanceRecurrenceType = "once" | "monthly" | "quarterly" | "annual" | "specific_dates";
export type FinanceAdjustmentType =
  | "none"
  | "cpi"
  | "wage_growth"
  | "interest_rate"
  | "fixed_annual_percent"
  | "custom_assumption";
export type FinanceInterestCalculationMode = "rate_on_principal" | "percentage_of_amount";
export type FinanceForecastRunStatus = "pending" | "completed" | "failed";

export type FinanceCategory = {
  id: string;
  householdId: string;
  name: string;
  parentId: string | null;
  cashFlowScope: FinanceCashFlowScope;
  sortOrder: number;
  isActive: boolean;
};

export type FinanceAccount = {
  id: string;
  householdId: string;
  name: string;
  accountType: FinanceAccountType;
  ownerMemberId: string | null;
  currency: string;
  maskedIdentifier: string | null;
  paymentEnabled: boolean;
  drawPriority: number;
  minimumBalance: number | null;
  isActive: boolean;
};

export type FinanceAccountBalanceSnapshot = {
  id: string;
  householdId: string;
  accountId: string;
  balanceDate: string;
  balance: number;
  source: FinanceBalanceSource;
};

export type FinanceAssumptionSeries = {
  id: string;
  householdId: string;
  seriesType: FinanceAssumptionSeriesType;
  name: string;
  frequency: FinanceAssumptionFrequency;
  unit: string;
  versionLabel: string;
  isDefault: boolean;
  isForecast: boolean;
};

export type FinanceAssumptionValue = {
  id: string;
  assumptionSeriesId: string;
  periodStart: string;
  value: number;
  valueStatus: FinanceAssumptionValueStatus;
};

export type FinanceCashFlowDefinition = {
  id: string;
  householdId: string;
  seriesId: string;
  versionNumber: number;
  cashFlowType: FinanceCashFlowType;
  categoryId: string | null;
  name: string;
  description: string | null;
  baseAmount: number;
  currency: string;
  ownerMemberId: string | null;
  validFrom: string;
  validTo: string | null;
  recurrenceType: FinanceRecurrenceType;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  quarterStartMonth: number | null;
  adjustmentType: FinanceAdjustmentType;
  assumptionSeriesId: string | null;
  adjustmentMonth: number | null;
  adjustmentDay: number | null;
  marginRate: number | null;
  floorRate: number | null;
  capRate: number | null;
  applyInBaseYear: boolean;
  interestCalculationMode: FinanceInterestCalculationMode | null;
  principalAmount: number | null;
  supersedesDefinitionId: string | null;
  isActive: boolean;
};

export type FinanceCashFlowSpecificDate = {
  id: string;
  definitionId: string;
  occurrenceDate: string;
  amountMultiplier: number;
  amountOverride: number | null;
};

export type FinanceCashFlowOccurrence = {
  id: string;
  householdId: string;
  definitionId: string;
  occurrenceDate: string;
  baseAmount: number;
  adjustedAmount: number;
  signedAmount: number;
  assumptionSeriesId: string | null;
  assumptionValue: number | null;
  isManualOverride: boolean;
  generationKey: string;
};

export type FinanceForecastRun = {
  id: string;
  householdId: string;
  forecastStart: string;
  forecastEnd: string;
  engineVersion: string;
  status: FinanceForecastRunStatus;
};

export type FinanceDailyLiquidityForecast = {
  id: string;
  householdId: string;
  forecastRunId: string;
  forecastDate: string;
  accountId: string | null;
  openingBalance: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  closingBalance: number;
  bufferDraw: number;
  isCritical: boolean;
};

export const FORECAST_ENGINE_VERSION = "finance-forecast-v1";
export const DEFAULT_FORECAST_HORIZON_YEARS = 10;
export const DEFAULT_BUFFER_SAFETY_MARGIN = 0.1;
