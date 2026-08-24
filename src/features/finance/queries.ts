// Finance read-side queries. Aggregates normalized source tables into the
// view models the /finance dashboard needs (read-model principle: nothing
// here is a second source of truth, it is derived from the latest forecast run).
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/features/household/queries";
import { computeMinimumRequiredBuffer, computeRecommendedBuffer } from "./domain/buffer-policy";

export type FinanceAccountSummary = {
  id: string;
  name: string;
  accountType: string;
  paymentEnabled: boolean;
  drawPriority: number;
  minimumBalance: number | null;
  latestBalance: number | null;
  latestBalanceDate: string | null;
};

export type FinanceCashFlowSummary = {
  seriesId: string;
  definitionId: string;
  name: string;
  cashFlowType: "income" | "expense";
  baseAmount: number;
  recurrenceType: string;
  validFrom: string;
  validTo: string | null;
};

export type FinanceForecastSummary = {
  forecastRunId: string;
  forecastStart: string;
  forecastEnd: string;
  lowestBalance: number;
  lowestBalanceDate: string | null;
  minimumRequiredBuffer: number;
  recommendedBuffer: number;
  criticalDayCount: number;
} | null;

export type FinanceOverview = {
  householdId: string;
  householdName: string;
  categories: { id: string; name: string; cashFlowScope: string }[];
  accounts: FinanceAccountSummary[];
  cashFlows: FinanceCashFlowSummary[];
  forecast: FinanceForecastSummary;
};

export async function getFinanceOverview(): Promise<FinanceOverview | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const adminSupabase = createAdminSupabaseClient();

  const [{ data: categories }, { data: accounts }, { data: definitions }] = await Promise.all([
    adminSupabase
      .from("finance_categories")
      .select("id, name, cash_flow_scope")
      .eq("household_id", membership.householdId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminSupabase
      .from("finance_accounts")
      .select("id, name, account_type, payment_enabled, draw_priority, minimum_balance")
      .eq("household_id", membership.householdId)
      .eq("is_active", true)
      .order("draw_priority", { ascending: true }),
    adminSupabase
      .from("finance_cash_flow_definitions")
      .select("id, series_id, name, cash_flow_type, base_amount, recurrence_type, valid_from, valid_to")
      .eq("household_id", membership.householdId)
      .eq("is_active", true)
      .order("valid_from", { ascending: false })
  ]);

  const accountSummaries: FinanceAccountSummary[] = [];
  for (const account of accounts ?? []) {
    const { data: snapshot } = await adminSupabase
      .from("finance_account_balance_snapshots")
      .select("balance, balance_date")
      .eq("account_id", account.id)
      .order("balance_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    accountSummaries.push({
      id: account.id,
      name: account.name,
      accountType: account.account_type,
      paymentEnabled: account.payment_enabled,
      drawPriority: account.draw_priority,
      minimumBalance: account.minimum_balance != null ? Number(account.minimum_balance) : null,
      latestBalance: snapshot ? Number(snapshot.balance) : null,
      latestBalanceDate: snapshot ? snapshot.balance_date : null
    });
  }

  const { data: latestRun } = await adminSupabase
    .from("finance_forecast_runs")
    .select("id, forecast_start, forecast_end")
    .eq("household_id", membership.householdId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let forecast: FinanceForecastSummary = null;

  if (latestRun) {
    const { data: aggregateRows } = await adminSupabase
      .from("finance_daily_liquidity_forecasts")
      .select("forecast_date, closing_balance, is_critical")
      .eq("forecast_run_id", latestRun.id)
      .is("account_id", null)
      .order("forecast_date", { ascending: true });

    const rows = aggregateRows ?? [];
    const closingBalances = rows.map((row) => Number(row.closing_balance));
    const minimumRequiredBuffer = computeMinimumRequiredBuffer(closingBalances);
    const recommendedBuffer = computeRecommendedBuffer(minimumRequiredBuffer);

    let lowestBalance = 0;
    let lowestBalanceDate: string | null = null;
    let criticalDayCount = 0;

    for (const row of rows) {
      const balance = Number(row.closing_balance);
      if (lowestBalanceDate === null || balance < lowestBalance) {
        lowestBalance = balance;
        lowestBalanceDate = row.forecast_date;
      }
      if (row.is_critical) criticalDayCount += 1;
    }

    forecast = {
      forecastRunId: latestRun.id,
      forecastStart: latestRun.forecast_start,
      forecastEnd: latestRun.forecast_end,
      lowestBalance,
      lowestBalanceDate,
      minimumRequiredBuffer,
      recommendedBuffer,
      criticalDayCount
    };
  }

  return {
    householdId: membership.householdId,
    householdName: membership.householdName,
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      cashFlowScope: category.cash_flow_scope
    })),
    accounts: accountSummaries,
    cashFlows: (definitions ?? []).map((definition) => ({
      seriesId: definition.series_id,
      definitionId: definition.id,
      name: definition.name,
      cashFlowType: definition.cash_flow_type,
      baseAmount: Number(definition.base_amount),
      recurrenceType: definition.recurrence_type,
      validFrom: definition.valid_from,
      validTo: definition.valid_to
    })),
    forecast
  };
}
