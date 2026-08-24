// Finance read-side queries. Aggregates normalized source tables into the
// view models the /finance dashboard needs (read-model principle: nothing
// here is a second source of truth, it is derived from the latest forecast run).
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/features/household/queries";
import { computeMinimumRequiredBuffer, computeRecommendedBuffer } from "./domain/buffer-policy";

export type FinanceHouseholdMemberOption = {
  id: string;
  displayName: string;
};

export type FinanceAccountSummary = {
  id: string;
  name: string;
  accountType: string;
  paymentEnabled: boolean;
  drawPriority: number;
  minimumBalance: number | null;
  ownerName: string | null;
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
  adjustmentType: string;
  ownerName: string | null;
  validFrom: string;
  validTo: string | null;
};

export type FinanceChartMonthPoint = {
  date: string;
  closingBalance: number;
  netCashFlow: number;
  isCritical: boolean;
};

export type FinanceChartYearPoint = {
  month: string;
  closingBalance: number;
  netCashFlow: number;
  isCritical: boolean;
};

export type FinanceChartMultiYearPoint = {
  year: string;
  closingBalance: number;
};

export type FinanceForecastChartData = {
  month: FinanceChartMonthPoint[];
  year: FinanceChartYearPoint[];
  multiYear: FinanceChartMultiYearPoint[];
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
  chart: FinanceForecastChartData;
} | null;

export type FinanceOverview = {
  householdId: string;
  householdName: string;
  categories: { id: string; name: string; cashFlowScope: string }[];
  accounts: FinanceAccountSummary[];
  cashFlows: FinanceCashFlowSummary[];
  householdMembers: FinanceHouseholdMemberOption[];
  forecast: FinanceForecastSummary;
};

function lastDayOfMonthIso(year: number, monthIndexZeroBased: number): string {
  return new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).toISOString().slice(0, 10);
}

/** Builds the (small, targeted) queries behind the month/year/multi-year forecast chart. */
async function getForecastChartData(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  forecastRunId: string,
  forecastStart: string,
  forecastEnd: string
): Promise<FinanceForecastChartData> {
  const [startYear, startMonth] = forecastStart.split("-").map(Number);

  const monthStart = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const monthEnd = lastDayOfMonthIso(startYear, startMonth - 1);

  const { data: monthRows } = await adminSupabase
    .from("finance_daily_liquidity_forecasts")
    .select("forecast_date, closing_balance, net_cash_flow, is_critical")
    .eq("forecast_run_id", forecastRunId)
    .is("account_id", null)
    .gte("forecast_date", monthStart)
    .lte("forecast_date", monthEnd)
    .order("forecast_date", { ascending: true });

  const yearEndCandidate = `${startYear + 1}-${forecastStart.slice(5, 10)}`;
  const yearEnd = yearEndCandidate < forecastEnd ? yearEndCandidate : forecastEnd;

  const { data: yearRows } = await adminSupabase
    .from("finance_daily_liquidity_forecasts")
    .select("forecast_date, closing_balance, net_cash_flow, is_critical")
    .eq("forecast_run_id", forecastRunId)
    .is("account_id", null)
    .gte("forecast_date", forecastStart)
    .lte("forecast_date", yearEnd)
    .order("forecast_date", { ascending: true });

  const monthlyBuckets = new Map<string, { closingBalance: number; netCashFlow: number; isCritical: boolean }>();
  for (const row of yearRows ?? []) {
    const monthKey = row.forecast_date.slice(0, 7);
    const bucket = monthlyBuckets.get(monthKey) ?? { closingBalance: 0, netCashFlow: 0, isCritical: false };
    bucket.closingBalance = Number(row.closing_balance);
    bucket.netCashFlow += Number(row.net_cash_flow);
    bucket.isCritical = bucket.isCritical || row.is_critical;
    monthlyBuckets.set(monthKey, bucket);
  }

  const endYear = Number(forecastEnd.slice(0, 4));
  const yearEndDates: string[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const candidate = `${year}-12-31`;
    yearEndDates.push(candidate <= forecastEnd ? candidate : forecastEnd);
  }

  const { data: multiYearRows } = await adminSupabase
    .from("finance_daily_liquidity_forecasts")
    .select("forecast_date, closing_balance")
    .eq("forecast_run_id", forecastRunId)
    .is("account_id", null)
    .in("forecast_date", Array.from(new Set(yearEndDates)))
    .order("forecast_date", { ascending: true });

  return {
    month: (monthRows ?? []).map((row) => ({
      date: row.forecast_date,
      closingBalance: Number(row.closing_balance),
      netCashFlow: Number(row.net_cash_flow),
      isCritical: row.is_critical
    })),
    year: Array.from(monthlyBuckets.entries()).map(([month, bucket]) => ({ month, ...bucket })),
    multiYear: (multiYearRows ?? []).map((row) => ({
      year: row.forecast_date.slice(0, 4),
      closingBalance: Number(row.closing_balance)
    }))
  };
}

export async function getFinanceOverview(): Promise<FinanceOverview | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const adminSupabase = createAdminSupabaseClient();

  const [{ data: categories }, { data: accounts }, { data: definitions }, { data: members }] = await Promise.all([
    adminSupabase
      .from("finance_categories")
      .select("id, name, cash_flow_scope")
      .eq("household_id", membership.householdId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminSupabase
      .from("finance_accounts")
      .select("id, name, account_type, payment_enabled, draw_priority, minimum_balance, owner_member_id")
      .eq("household_id", membership.householdId)
      .eq("is_active", true)
      .order("draw_priority", { ascending: true }),
    adminSupabase
      .from("finance_cash_flow_definitions")
      .select(
        "id, series_id, name, cash_flow_type, base_amount, recurrence_type, adjustment_type, owner_member_id, valid_from, valid_to"
      )
      .eq("household_id", membership.householdId)
      .eq("is_active", true)
      .order("valid_from", { ascending: false }),
    adminSupabase
      .from("household_members")
      .select("id, user_id")
      .eq("household_id", membership.householdId)
      .order("joined_at", { ascending: true })
  ]);

  const memberProfileIds = (members ?? []).map((member) => member.user_id);
  const { data: memberProfiles } = memberProfileIds.length
    ? await adminSupabase.from("profiles").select("id, display_name").in("id", memberProfileIds)
    : { data: [] as { id: string; display_name: string }[] };

  const profileNameByProfileId = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const memberNameByMemberId = new Map(
    (members ?? []).map((member) => [member.id, profileNameByProfileId.get(member.user_id) ?? "Ukjent"])
  );

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
      ownerName: account.owner_member_id ? (memberNameByMemberId.get(account.owner_member_id) ?? null) : null,
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
    // Fetch only the single lowest-balance row and a count, instead of every
    // daily row, so this stays cheap and correct even for a 10-year horizon
    // (a plain unranged select would silently truncate at PostgREST's default row cap).
    const { data: lowestRow } = await adminSupabase
      .from("finance_daily_liquidity_forecasts")
      .select("forecast_date, closing_balance")
      .eq("forecast_run_id", latestRun.id)
      .is("account_id", null)
      .order("closing_balance", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { count: criticalDayCount } = await adminSupabase
      .from("finance_daily_liquidity_forecasts")
      .select("id", { count: "exact", head: true })
      .eq("forecast_run_id", latestRun.id)
      .is("account_id", null)
      .eq("is_critical", true);

    const lowestBalance = lowestRow ? Number(lowestRow.closing_balance) : 0;
    const minimumRequiredBuffer = computeMinimumRequiredBuffer([lowestBalance]);
    const recommendedBuffer = computeRecommendedBuffer(minimumRequiredBuffer);

    const chart = await getForecastChartData(adminSupabase, latestRun.id, latestRun.forecast_start, latestRun.forecast_end);

    forecast = {
      forecastRunId: latestRun.id,
      forecastStart: latestRun.forecast_start,
      forecastEnd: latestRun.forecast_end,
      lowestBalance,
      lowestBalanceDate: lowestRow?.forecast_date ?? null,
      minimumRequiredBuffer,
      recommendedBuffer,
      criticalDayCount: criticalDayCount ?? 0,
      chart
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
      adjustmentType: definition.adjustment_type,
      ownerName: definition.owner_member_id ? (memberNameByMemberId.get(definition.owner_member_id) ?? null) : null,
      validFrom: definition.valid_from,
      validTo: definition.valid_to
    })),
    householdMembers: (members ?? []).map((member) => ({
      id: member.id,
      displayName: memberNameByMemberId.get(member.id) ?? "Ukjent"
    })),
    forecast
  };
}

