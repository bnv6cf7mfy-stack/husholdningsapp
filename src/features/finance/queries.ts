// Finance read-side queries. Aggregates normalized source tables into the
// view models the /finance dashboard needs (read-model principle: nothing
// here is a second source of truth, it is derived from the latest forecast run).
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";
import { computeMinimumRequiredBuffer, computeRecommendedBuffer } from "./domain/buffer-policy";

export type FinanceHouseholdMemberOption = {
  id: string;
  displayName: string;
};

export type FinanceCategoryOption = {
  id: string;
  name: string;
  parentId: string | null;
  cashFlowScope: string;
};

export type FinanceAccountSummary = {
  id: string;
  name: string;
  accountType: string;
  paymentEnabled: boolean;
  drawPriority: number;
  minimumBalance: number | null;
  ownerMemberId: string | null;
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
  categoryId: string | null;
  categoryName: string | null;
  recurrenceType: string;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  quarterStartMonth: number | null;
  adjustmentType: string;
  marginRate: number | null;
  ownerMemberId: string | null;
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
  netCashFlow: number;
};

export const FELLES_MEMBER_KEY = "felles";
export const ALL_HOUSEHOLD_OWNER_KEY = "all";

export type FinanceMemberChartSeries = {
  ownerKey: string;
  ownerLabel: string;
  month: FinanceChartMonthPoint[];
  year: FinanceChartYearPoint[];
  multiYear: FinanceChartMultiYearPoint[];
};

export type FinanceForecastChartData = {
  month: FinanceChartMonthPoint[];
  year: FinanceChartYearPoint[];
  multiYear: FinanceChartMultiYearPoint[];
  /** Cumulative net contribution per household member (and "Felles"), independent of account balances. */
  perMember: FinanceMemberChartSeries[];
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
  currentMemberId: string | null;
  categories: FinanceCategoryOption[];
  accounts: FinanceAccountSummary[];
  cashFlows: FinanceCashFlowSummary[];
  householdMembers: FinanceHouseholdMemberOption[];
  forecast: FinanceForecastSummary;
};

function lastDayOfMonthIso(year: number, monthIndexZeroBased: number): string {
  return new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Computes, per household member (and a "Felles" bucket for unowned cash flows), the
 * cumulative net contribution (income minus expense) over the same three windows as the
 * household chart. This is not a real account balance — it shows the shape/trend of each
 * member's own registered cash flows, since accounts are not attributed per member in v1.0
 * (see docs/FINANCE_DOMAIN.md).
 */
async function getMemberCashFlowChartSeries(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  householdId: string,
  forecastStart: string,
  forecastEnd: string,
  members: { id: string; displayName: string }[]
): Promise<FinanceMemberChartSeries[]> {
  const [startYear, startMonth] = forecastStart.split("-").map(Number);
  const monthStart = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const monthEnd = lastDayOfMonthIso(startYear, startMonth - 1);

  const monthDates: string[] = [];
  {
    const cursor = new Date(`${monthStart}T00:00:00Z`);
    const end = new Date(`${monthEnd}T00:00:00Z`);
    while (cursor <= end) {
      monthDates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const yearMonthEndDates: string[] = [];
  {
    let y = startYear;
    let m = startMonth - 1;
    for (let i = 0; i < 12; i += 1) {
      const candidate = lastDayOfMonthIso(y, m);
      yearMonthEndDates.push(candidate <= forecastEnd ? candidate : forecastEnd);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }

  const endYear = Number(forecastEnd.slice(0, 4));
  const multiYearDates: string[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const candidate = `${year}-12-31`;
    multiYearDates.push(candidate <= forecastEnd ? candidate : forecastEnd);
  }

  const checkpointDates = Array.from(new Set([...monthDates, ...yearMonthEndDates, ...multiYearDates])).sort();

  // Paginate through every occurrence in the horizon: a plain unranged select would
  // silently truncate at PostgREST's default row cap for long horizons.
  const pageSize = 1000;
  let offset = 0;
  const occurrences: { date: string; ownerKey: string; amount: number }[] = [];

  while (true) {
    const { data, error } = await adminSupabase
      .from("finance_cash_flow_occurrences")
      .select("occurrence_date, signed_amount, finance_cash_flow_definitions(owner_member_id)")
      .eq("household_id", householdId)
      .gte("occurrence_date", forecastStart)
      .lte("occurrence_date", forecastEnd)
      .order("occurrence_date", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      const definition = row.finance_cash_flow_definitions as unknown as { owner_member_id: string | null } | null;
      occurrences.push({
        date: row.occurrence_date,
        ownerKey: definition?.owner_member_id ?? FELLES_MEMBER_KEY,
        amount: Number(row.signed_amount)
      });
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const ownerOptions = [
    ...members.map((member) => ({ key: member.id, label: member.displayName })),
    { key: FELLES_MEMBER_KEY, label: "Felles" }
  ];

  const runningTotal = new Map<string, number>(ownerOptions.map((owner) => [owner.key, 0]));
  const snapshotsByDate = new Map<string, Map<string, number>>();

  let occurrenceIndex = 0;
  for (const checkpoint of checkpointDates) {
    while (occurrenceIndex < occurrences.length && occurrences[occurrenceIndex].date <= checkpoint) {
      const occurrence = occurrences[occurrenceIndex];
      runningTotal.set(occurrence.ownerKey, (runningTotal.get(occurrence.ownerKey) ?? 0) + occurrence.amount);
      occurrenceIndex += 1;
    }
    snapshotsByDate.set(checkpoint, new Map(runningTotal));
  }

  const valueAt = (date: string, ownerKey: string) => snapshotsByDate.get(date)?.get(ownerKey) ?? 0;

  return ownerOptions.map(({ key, label }) => {
    let previousMonthValue = 0;
    const month = monthDates.map((date) => {
      const value = valueAt(date, key);
      const point = { date, closingBalance: value, netCashFlow: value - previousMonthValue, isCritical: false };
      previousMonthValue = value;
      return point;
    });

    let previousYearValue = 0;
    const year = yearMonthEndDates.map((date) => {
      const value = valueAt(date, key);
      const point = { month: date.slice(0, 7), closingBalance: value, netCashFlow: value - previousYearValue, isCritical: false };
      previousYearValue = value;
      return point;
    });

    let previousMultiYearValue = 0;
    const multiYear = multiYearDates.map((date) => {
      const value = valueAt(date, key);
      const point = { year: date.slice(0, 4), closingBalance: value, netCashFlow: value - previousMultiYearValue };
      previousMultiYearValue = value;
      return point;
    });

    return { ownerKey: key, ownerLabel: label, month, year, multiYear };
  });
}

/** Builds the (small, targeted) queries behind the month/year/multi-year forecast chart. */
async function getForecastChartData(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  householdId: string,
  forecastRunId: string,
  forecastStart: string,
  forecastEnd: string,
  members: { id: string; displayName: string }[]
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

  // The aggregate row's opening balance on day one, used as the baseline for the
  // first (possibly partial) year's net cash flow (closingBalance[year] - previousBaseline).
  const { data: openingRow } = await adminSupabase
    .from("finance_daily_liquidity_forecasts")
    .select("opening_balance")
    .eq("forecast_run_id", forecastRunId)
    .is("account_id", null)
    .eq("forecast_date", forecastStart)
    .maybeSingle();

  let previousYearEndBalance = openingRow ? Number(openingRow.opening_balance) : 0;

  const perMember = await getMemberCashFlowChartSeries(adminSupabase, householdId, forecastStart, forecastEnd, members);

  return {
    month: (monthRows ?? []).map((row) => ({
      date: row.forecast_date,
      closingBalance: Number(row.closing_balance),
      netCashFlow: Number(row.net_cash_flow),
      isCritical: row.is_critical
    })),
    year: Array.from(monthlyBuckets.entries()).map(([month, bucket]) => ({ month, ...bucket })),
    multiYear: (multiYearRows ?? []).map((row) => {
      const closingBalance = Number(row.closing_balance);
      const netCashFlow = closingBalance - previousYearEndBalance;
      previousYearEndBalance = closingBalance;
      return { year: row.forecast_date.slice(0, 4), closingBalance, netCashFlow };
    }),
    perMember
  };
}

/** Fetches every cash flow occurrence for one owner (a member id, or FELLES_MEMBER_KEY for unowned), paginated. */
async function fetchOwnerOccurrences(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  householdId: string,
  ownerKey: string,
  fromDate: string,
  toDate: string
): Promise<{ date: string; amount: number }[]> {
  const pageSize = 1000;
  let offset = 0;
  const rows: { date: string; amount: number }[] = [];

  while (true) {
    let query = adminSupabase
      .from("finance_cash_flow_occurrences")
      .select("occurrence_date, signed_amount, finance_cash_flow_definitions!inner(owner_member_id)")
      .eq("household_id", householdId)
      .gte("occurrence_date", fromDate)
      .lte("occurrence_date", toDate)
      .order("occurrence_date", { ascending: true })
      .range(offset, offset + pageSize - 1);

    query =
      ownerKey === FELLES_MEMBER_KEY
        ? query.is("finance_cash_flow_definitions.owner_member_id", null)
        : query.eq("finance_cash_flow_definitions.owner_member_id", ownerKey);

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;

    for (const row of data) {
      rows.push({ date: row.occurrence_date, amount: Number(row.signed_amount) });
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

export type FinanceChartSelectionResult =
  | { view: "month"; points: FinanceChartMonthPoint[] }
  | { view: "year"; points: FinanceChartYearPoint[] }
  | { error: string };

/**
 * On-demand fetch for an arbitrary month or year (beyond the default first month/year
 * already preloaded in `FinanceOverview.forecast.chart`), used when the user picks a
 * different month/year in the chart. "all" reads real balances directly; a specific
 * member/"felles" recomputes the cumulative net contribution up to each day, since that
 * view has no persisted per-day rows of its own (see docs/FINANCE_DOMAIN.md).
 */
export async function getFinanceChartSelection(input: {
  view: "month" | "year";
  year: number;
  month?: number;
  ownerKey: string;
}): Promise<FinanceChartSelectionResult> {
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Ingen aktiv husholdning." };

  const adminSupabase = createAdminSupabaseClient();

  const { data: latestRun } = await adminSupabase
    .from("finance_forecast_runs")
    .select("id, forecast_start, forecast_end")
    .eq("household_id", membership.householdId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) return { error: "Ingen prognose kjørt ennå." };

  const forecastStart = latestRun.forecast_start;
  const forecastEnd = latestRun.forecast_end;

  const rangeStart =
    input.view === "month" ? `${input.year}-${String(input.month ?? 1).padStart(2, "0")}-01` : `${input.year}-01-01`;
  const rangeEndCandidate =
    input.view === "month" ? lastDayOfMonthIso(input.year, (input.month ?? 1) - 1) : `${input.year}-12-31`;

  const start = rangeStart < forecastStart ? forecastStart : rangeStart;
  const end = rangeEndCandidate > forecastEnd ? forecastEnd : rangeEndCandidate;

  if (start > end) {
    return input.view === "month" ? { view: "month", points: [] } : { view: "year", points: [] };
  }

  if (input.ownerKey === ALL_HOUSEHOLD_OWNER_KEY) {
    const { data } = await adminSupabase
      .from("finance_daily_liquidity_forecasts")
      .select("forecast_date, closing_balance, net_cash_flow, is_critical")
      .eq("forecast_run_id", latestRun.id)
      .is("account_id", null)
      .gte("forecast_date", start)
      .lte("forecast_date", end)
      .order("forecast_date", { ascending: true });

    if (input.view === "month") {
      return {
        view: "month",
        points: (data ?? []).map((row) => ({
          date: row.forecast_date,
          closingBalance: Number(row.closing_balance),
          netCashFlow: Number(row.net_cash_flow),
          isCritical: row.is_critical
        }))
      };
    }

    const monthlyBuckets = new Map<string, { closingBalance: number; netCashFlow: number; isCritical: boolean }>();
    for (const row of data ?? []) {
      const monthKey = row.forecast_date.slice(0, 7);
      const bucket = monthlyBuckets.get(monthKey) ?? { closingBalance: 0, netCashFlow: 0, isCritical: false };
      bucket.closingBalance = Number(row.closing_balance);
      bucket.netCashFlow += Number(row.net_cash_flow);
      bucket.isCritical = bucket.isCritical || row.is_critical;
      monthlyBuckets.set(monthKey, bucket);
    }
    return { view: "year", points: Array.from(monthlyBuckets.entries()).map(([month, bucket]) => ({ month, ...bucket })) };
  }

  // Per-member/"felles": recompute the cumulative running total from forecastStart.
  const occurrences = await fetchOwnerOccurrences(adminSupabase, membership.householdId, input.ownerKey, forecastStart, end);

  const checkpointDates: string[] = [];
  if (input.view === "month") {
    const cursor = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    while (cursor <= endDate) {
      checkpointDates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7)) - 1;
    const endYear = Number(end.slice(0, 4));
    const endMonth = Number(end.slice(5, 7)) - 1;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      checkpointDates.push(lastDayOfMonthIso(y, m));
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }

  let running = 0;
  let occurrenceIndex = 0;
  while (occurrenceIndex < occurrences.length && occurrences[occurrenceIndex].date < start) {
    running += occurrences[occurrenceIndex].amount;
    occurrenceIndex += 1;
  }
  let previous = running;

  if (input.view === "month") {
    const points: FinanceChartMonthPoint[] = checkpointDates.map((date) => {
      while (occurrenceIndex < occurrences.length && occurrences[occurrenceIndex].date <= date) {
        running += occurrences[occurrenceIndex].amount;
        occurrenceIndex += 1;
      }
      const point = { date, closingBalance: running, netCashFlow: running - previous, isCritical: false };
      previous = running;
      return point;
    });
    return { view: "month", points };
  }

  const points: FinanceChartYearPoint[] = checkpointDates.map((date) => {
    while (occurrenceIndex < occurrences.length && occurrences[occurrenceIndex].date <= date) {
      running += occurrences[occurrenceIndex].amount;
      occurrenceIndex += 1;
    }
    const point = { month: date.slice(0, 7), closingBalance: running, netCashFlow: running - previous, isCritical: false };
    previous = running;
    return point;
  });
  return { view: "year", points };
}

export async function getFinanceOverview(): Promise<FinanceOverview | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const adminSupabase = createAdminSupabaseClient();

  const [{ data: categories }, { data: accounts }, { data: definitions }, { data: members }] = await Promise.all([
    adminSupabase
      .from("finance_categories")
      .select("id, name, parent_id, cash_flow_scope")
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
        "id, series_id, name, cash_flow_type, base_amount, category_id, recurrence_type, day_of_month, month_of_year, quarter_start_month, adjustment_type, margin_rate, owner_member_id, valid_from, valid_to"
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

  const categoryNameById = new Map((categories ?? []).map((category) => [category.id, category.name]));

  const currentProfileId = await getCurrentProfileId();
  const currentMemberId = (members ?? []).find((member) => member.user_id === currentProfileId)?.id ?? null;

  // Fetch each account's latest balance snapshot in parallel instead of one
  // sequential round-trip per account (previously an N+1 pattern that made the
  // whole dashboard noticeably slower to refresh as households add accounts).
  const accountSummaries: FinanceAccountSummary[] = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { data: snapshot } = await adminSupabase
        .from("finance_account_balance_snapshots")
        .select("balance, balance_date")
        .eq("account_id", account.id)
        .order("balance_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: account.id,
        name: account.name,
        accountType: account.account_type,
        paymentEnabled: account.payment_enabled,
        drawPriority: account.draw_priority,
        minimumBalance: account.minimum_balance != null ? Number(account.minimum_balance) : null,
        ownerMemberId: account.owner_member_id,
        ownerName: account.owner_member_id ? (memberNameByMemberId.get(account.owner_member_id) ?? null) : null,
        latestBalance: snapshot ? Number(snapshot.balance) : null,
        latestBalanceDate: snapshot ? snapshot.balance_date : null
      };
    })
  );

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

    const memberOptionsForChart = (members ?? []).map((member) => ({
      id: member.id,
      displayName: memberNameByMemberId.get(member.id) ?? "Ukjent"
    }));
    const chart = await getForecastChartData(
      adminSupabase,
      membership.householdId,
      latestRun.id,
      latestRun.forecast_start,
      latestRun.forecast_end,
      memberOptionsForChart
    );

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
    currentMemberId,
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parent_id,
      cashFlowScope: category.cash_flow_scope
    })),
    accounts: accountSummaries,
    cashFlows: (definitions ?? []).map((definition) => ({
      seriesId: definition.series_id,
      definitionId: definition.id,
      name: definition.name,
      cashFlowType: definition.cash_flow_type,
      baseAmount: Number(definition.base_amount),
      categoryId: definition.category_id,
      categoryName: definition.category_id ? (categoryNameById.get(definition.category_id) ?? null) : null,
      recurrenceType: definition.recurrence_type,
      dayOfMonth: definition.day_of_month,
      monthOfYear: definition.month_of_year,
      quarterStartMonth: definition.quarter_start_month,
      adjustmentType: definition.adjustment_type,
      marginRate: definition.margin_rate != null ? Number(definition.margin_rate) : null,
      ownerMemberId: definition.owner_member_id,
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

