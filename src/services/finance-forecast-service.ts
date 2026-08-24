// Orchestrates Finance forecast generation: reads normalized source data via
// the admin Supabase client, runs the pure domain engine, and persists the
// regenerable read models (occurrences cache + daily liquidity forecast).
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateRecurrenceDates } from "@/features/finance/domain/recurrence";
import { applyAdjustment, type AssumptionRateLookup } from "@/features/finance/domain/adjustments";
import { runDailyForecast, type ForecastAccountInput, type ForecastCashFlowInput } from "@/features/finance/domain/forecast-engine";
import { DEFAULT_FORECAST_HORIZON_YEARS, FORECAST_ENGINE_VERSION } from "@/features/finance/types";

const INSERT_BATCH_SIZE = 500;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function chunkedInsert(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  table: string,
  rows: Record<string, unknown>[]
) {
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await adminSupabase.from(table).insert(batch);
    if (error) {
      throw new Error(`Failed inserting into ${table}: ${error.message}`);
    }
  }
}

/**
 * Generates occurrences for all definitions relevant to the forecast window and
 * runs the daily liquidity engine, persisting a new forecast run + read model.
 * Idempotent: occurrences are upserted by (definition_id, occurrence_date), and
 * each call creates a fresh forecast_run so historical runs remain auditable.
 */
export async function runForecastForHousehold(
  householdId: string,
  profileId: string,
  horizonYears: number = DEFAULT_FORECAST_HORIZON_YEARS
): Promise<{ forecastRunId: string }> {
  const adminSupabase = createAdminSupabaseClient();
  const forecastStart = todayIsoDate();
  const forecastEnd = addYears(forecastStart, horizonYears);

  const { data: forecastRun, error: forecastRunError } = await adminSupabase
    .from("finance_forecast_runs")
    .insert({
      household_id: householdId,
      forecast_start: forecastStart,
      forecast_end: forecastEnd,
      engine_version: FORECAST_ENGINE_VERSION,
      status: "pending",
      created_by: profileId
    })
    .select("id")
    .single();

  if (forecastRunError || !forecastRun) {
    throw new Error(forecastRunError?.message ?? "Failed to create forecast run");
  }

  try {
    const { data: definitions } = await adminSupabase
      .from("finance_cash_flow_definitions")
      .select("*")
      .eq("household_id", householdId)
      .lte("valid_from", forecastEnd)
      .or(`valid_to.is.null,valid_to.gte.${forecastStart}`);

    const definitionRows = definitions ?? [];

    const { data: specificDateRows } = await adminSupabase
      .from("finance_cash_flow_specific_dates")
      .select("*")
      .eq("household_id", householdId);

    const specificDatesByDefinition = new Map<string, typeof specificDateRows>();
    for (const row of specificDateRows ?? []) {
      const list = specificDatesByDefinition.get(row.definition_id) ?? [];
      list.push(row);
      specificDatesByDefinition.set(row.definition_id, list);
    }

    const assumptionSeriesIds = Array.from(
      new Set(definitionRows.map((definition) => definition.assumption_series_id).filter(Boolean))
    );

    const assumptionValuesBySeries = new Map<string, Map<string, number>>();
    if (assumptionSeriesIds.length > 0) {
      const { data: assumptionValues } = await adminSupabase
        .from("finance_assumption_values")
        .select("assumption_series_id, period_start, value")
        .in("assumption_series_id", assumptionSeriesIds);

      for (const row of assumptionValues ?? []) {
        const periodMap = assumptionValuesBySeries.get(row.assumption_series_id) ?? new Map<string, number>();
        periodMap.set(row.period_start, Number(row.value));
        assumptionValuesBySeries.set(row.assumption_series_id, periodMap);
      }
    }

    const lookupRate: AssumptionRateLookup = (assumptionSeriesId, periodStart) =>
      assumptionValuesBySeries.get(assumptionSeriesId)?.get(periodStart);

    const occurrenceRows: Record<string, unknown>[] = [];
    const cashFlowInputs: ForecastCashFlowInput[] = [];

    for (const definition of definitionRows) {
      const specificDates = (specificDatesByDefinition.get(definition.id) ?? []).map((row) => ({
        occurrenceDate: row.occurrence_date as string
      }));

      const dates = generateRecurrenceDates(
        {
          recurrenceType: definition.recurrence_type,
          validFrom: definition.valid_from,
          validTo: definition.valid_to,
          dayOfMonth: definition.day_of_month,
          monthOfYear: definition.month_of_year,
          quarterStartMonth: definition.quarter_start_month
        },
        forecastStart,
        forecastEnd,
        specificDates
      );

      const specificDateOverrides = new Map(
        (specificDatesByDefinition.get(definition.id) ?? []).map((row) => [row.occurrence_date as string, row])
      );

      for (const occurrenceDate of dates) {
        const override = specificDateOverrides.get(occurrenceDate);
        const baseAmount = override?.amount_override != null
          ? Number(override.amount_override)
          : Number(definition.base_amount) * (override?.amount_multiplier != null ? Number(override.amount_multiplier) : 1);

        const adjustedAmount = applyAdjustment(
          {
            adjustmentType: definition.adjustment_type,
            assumptionSeriesId: definition.assumption_series_id,
            adjustmentMonth: definition.adjustment_month,
            adjustmentDay: definition.adjustment_day,
            marginRate: definition.margin_rate != null ? Number(definition.margin_rate) : null,
            floorRate: definition.floor_rate != null ? Number(definition.floor_rate) : null,
            capRate: definition.cap_rate != null ? Number(definition.cap_rate) : null,
            applyInBaseYear: definition.apply_in_base_year,
            interestCalculationMode: definition.interest_calculation_mode,
            principalAmount: definition.principal_amount != null ? Number(definition.principal_amount) : null,
            validFrom: definition.valid_from
          },
          occurrenceDate,
          baseAmount,
          lookupRate
        );

        const signedAmount = definition.cash_flow_type === "income" ? adjustedAmount : -adjustedAmount;

        occurrenceRows.push({
          household_id: householdId,
          definition_id: definition.id,
          occurrence_date: occurrenceDate,
          base_amount: baseAmount,
          adjusted_amount: adjustedAmount,
          signed_amount: signedAmount,
          assumption_series_id: definition.assumption_series_id,
          is_manual_override: override?.amount_override != null,
          generation_key: `${FORECAST_ENGINE_VERSION}:${occurrenceDate}`
        });

        cashFlowInputs.push({ occurrenceDate, signedAmount });
      }
    }

    if (occurrenceRows.length > 0) {
      for (let i = 0; i < occurrenceRows.length; i += INSERT_BATCH_SIZE) {
        const batch = occurrenceRows.slice(i, i + INSERT_BATCH_SIZE);
        const { error } = await adminSupabase
          .from("finance_cash_flow_occurrences")
          .upsert(batch, { onConflict: "definition_id,occurrence_date" });
        if (error) {
          throw new Error(`Failed upserting occurrences: ${error.message}`);
        }
      }
    }

    const { data: accountRows } = await adminSupabase
      .from("finance_accounts")
      .select("id, payment_enabled, draw_priority, minimum_balance")
      .eq("household_id", householdId)
      .eq("is_active", true);

    const accounts = accountRows ?? [];
    const accountInputs: ForecastAccountInput[] = [];

    for (const account of accounts) {
      const { data: latestSnapshot } = await adminSupabase
        .from("finance_account_balance_snapshots")
        .select("balance, balance_date")
        .eq("account_id", account.id)
        .lte("balance_date", forecastStart)
        .order("balance_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      accountInputs.push({
        id: account.id,
        paymentEnabled: account.payment_enabled,
        drawPriority: account.draw_priority,
        minimumBalance: account.minimum_balance != null ? Number(account.minimum_balance) : null,
        openingBalance: latestSnapshot ? Number(latestSnapshot.balance) : 0
      });
    }

    const dailyResults = runDailyForecast({
      forecastStart,
      forecastEnd,
      accounts: accountInputs,
      cashFlows: cashFlowInputs
    });

    const dailyForecastRows = dailyResults.map((result) => ({
      household_id: householdId,
      forecast_run_id: forecastRun.id,
      forecast_date: result.forecastDate,
      account_id: result.accountId,
      opening_balance: result.openingBalance,
      cash_inflow: result.cashInflow,
      cash_outflow: result.cashOutflow,
      net_cash_flow: result.netCashFlow,
      closing_balance: result.closingBalance,
      buffer_draw: result.bufferDraw,
      is_critical: result.isCritical
    }));

    await chunkedInsert(adminSupabase, "finance_daily_liquidity_forecasts", dailyForecastRows);

    await adminSupabase
      .from("finance_forecast_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", forecastRun.id);

    return { forecastRunId: forecastRun.id };
  } catch (error) {
    await adminSupabase
      .from("finance_forecast_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown error"
      })
      .eq("id", forecastRun.id);
    throw error;
  }
}
