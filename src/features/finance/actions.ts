// Finance write-side entry points (server actions). Access to Supabase is
// via the admin client, matching the existing shopping/household pattern:
// the server resolves and validates household membership before any mutation,
// and every insert/update is explicitly scoped by household_id (defense in
// depth alongside the RLS policies defined in the finance domain migration).
"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";
import {
  addFinanceBalanceSnapshotSchema,
  createFinanceAccountSchema,
  createFinanceCashFlowSchema,
  createFinanceCategorySchema,
  reviseFinanceCashFlowSchema
} from "./schemas";
import { runForecastForHousehold } from "@/services/finance-forecast-service";
import type { z } from "zod";

/** Surfaces the first Zod issue instead of a generic "invalid input" message. */
function describeParseError(result: z.ZodSafeParseError<unknown>, fallback: string): string {
  const issue = result.error.issues[0];
  return issue ? issue.message : fallback;
}

async function resolveFinanceContext() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const profileId = await getCurrentProfileId();
  if (!profileId) return null;

  return { householdId: membership.householdId, profileId };
}

/** Verifies a household_members row belongs to the given household (defense in depth). */
async function assertMemberBelongsToHousehold(memberId: string | null | undefined, householdId: string) {
  if (!memberId) return true;
  const adminSupabase = createAdminSupabaseClient();
  const { data } = await adminSupabase
    .from("household_members")
    .select("id")
    .eq("id", memberId)
    .eq("household_id", householdId)
    .maybeSingle();
  return Boolean(data);
}

async function assertCategoryBelongsToHousehold(categoryId: string | null | undefined, householdId: string) {
  if (!categoryId) return true;
  const adminSupabase = createAdminSupabaseClient();
  const { data } = await adminSupabase
    .from("finance_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("household_id", householdId)
    .maybeSingle();
  return Boolean(data);
}

export type FinanceActionResult = { ok: true } | { ok: false; error: string };

export async function createFinanceCategoryAction(input: unknown): Promise<FinanceActionResult> {
  const parsed = createFinanceCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: describeParseError(parsed, "Ugyldig kategori.") };
  }

  const context = await resolveFinanceContext();
  if (!context) {
    return { ok: false, error: "Ingen aktiv husholdning." };
  }

  if (!(await assertCategoryBelongsToHousehold(parsed.data.parentId, context.householdId))) {
    return { ok: false, error: "Overordnet kategori tilhører ikke husholdningen." };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { error } = await adminSupabase.from("finance_categories").insert({
    household_id: context.householdId,
    name: parsed.data.name,
    parent_id: parsed.data.parentId ?? null,
    cash_flow_scope: parsed.data.cashFlowScope,
    created_by: context.profileId
  });

  revalidatePath("/finance");
  return error ? { ok: false, error: "Kunne ikke opprette kategori. Navnet finnes kanskje allerede." } : { ok: true };
}

export async function createFinanceAccountAction(input: unknown): Promise<FinanceActionResult> {
  const parsed = createFinanceAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: describeParseError(parsed, "Ugyldig kontoinformasjon.") };
  }

  const context = await resolveFinanceContext();
  if (!context) {
    return { ok: false, error: "Ingen aktiv husholdning." };
  }

  if (!(await assertMemberBelongsToHousehold(parsed.data.ownerMemberId, context.householdId))) {
    return { ok: false, error: "Eier tilhører ikke husholdningen." };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { error } = await adminSupabase.from("finance_accounts").insert({
    household_id: context.householdId,
    name: parsed.data.name,
    account_type: parsed.data.accountType,
    owner_member_id: parsed.data.ownerMemberId ?? null,
    currency: parsed.data.currency,
    masked_identifier: parsed.data.maskedIdentifier ?? null,
    payment_enabled: parsed.data.paymentEnabled,
    draw_priority: parsed.data.drawPriority,
    minimum_balance: parsed.data.minimumBalance ?? null,
    created_by: context.profileId
  });

  revalidatePath("/finance");
  return error ? { ok: false, error: "Kunne ikke opprette konto." } : { ok: true };
}

export async function addFinanceBalanceSnapshotAction(input: unknown): Promise<FinanceActionResult> {
  const parsed = addFinanceBalanceSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: describeParseError(parsed, "Ugyldig saldopunkt.") };
  }

  const context = await resolveFinanceContext();
  if (!context) {
    return { ok: false, error: "Ingen aktiv husholdning." };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: account } = await adminSupabase
    .from("finance_accounts")
    .select("id")
    .eq("id", parsed.data.accountId)
    .eq("household_id", context.householdId)
    .maybeSingle();

  if (!account) {
    return { ok: false, error: "Konto tilhører ikke husholdningen." };
  }

  const { error } = await adminSupabase.from("finance_account_balance_snapshots").upsert(
    {
      household_id: context.householdId,
      account_id: parsed.data.accountId,
      balance_date: parsed.data.balanceDate,
      balance: parsed.data.balance,
      source: "manual",
      created_by: context.profileId
    },
    { onConflict: "account_id,balance_date" }
  );

  revalidatePath("/finance");
  return error ? { ok: false, error: "Kunne ikke lagre saldopunkt." } : { ok: true };
}

export async function createFinanceCashFlowAction(input: unknown): Promise<FinanceActionResult> {
  const parsed = createFinanceCashFlowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: describeParseError(parsed, "Ugyldig kontantstrøm.") };
  }

  const context = await resolveFinanceContext();
  if (!context) {
    return { ok: false, error: "Ingen aktiv husholdning." };
  }

  const data = parsed.data;

  if (!(await assertMemberBelongsToHousehold(data.ownerMemberId, context.householdId))) {
    return { ok: false, error: "Eier tilhører ikke husholdningen." };
  }
  if (!(await assertCategoryBelongsToHousehold(data.categoryId, context.householdId))) {
    return { ok: false, error: "Kategori tilhører ikke husholdningen." };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: series, error: seriesError } = await adminSupabase
    .from("finance_cash_flow_series")
    .insert({ household_id: context.householdId, name: data.name, created_by: context.profileId })
    .select("id")
    .single();

  if (seriesError || !series) {
    return { ok: false, error: "Kunne ikke opprette serien." };
  }

  const { data: definition, error: definitionError } = await adminSupabase
    .from("finance_cash_flow_definitions")
    .insert({
      household_id: context.householdId,
      series_id: series.id,
      version_number: 1,
      cash_flow_type: data.cashFlowType,
      category_id: data.categoryId ?? null,
      name: data.name,
      description: data.description ?? null,
      base_amount: data.baseAmount,
      owner_member_id: data.ownerMemberId ?? null,
      valid_from: data.validFrom,
      valid_to: data.validTo ?? null,
      recurrence_type: data.recurrenceType,
      day_of_month: data.dayOfMonth ?? null,
      month_of_year: data.monthOfYear ?? null,
      quarter_start_month: data.quarterStartMonth ?? null,
      adjustment_type: data.adjustmentType,
      assumption_series_id: data.assumptionSeriesId ?? null,
      margin_rate: data.adjustmentType === "fixed_annual_percent" ? (data.fixedAnnualPercent ?? 0) : (data.marginRate ?? null),
      floor_rate: data.floorRate ?? null,
      cap_rate: data.capRate ?? null,
      apply_in_base_year: data.applyInBaseYear,
      created_by: context.profileId
    })
    .select("id")
    .single();

  if (definitionError || !definition) {
    return { ok: false, error: "Kunne ikke opprette kontantstrømmen." };
  }

  if (data.recurrenceType === "specific_dates" && data.specificDates.length > 0) {
    const rows = data.specificDates.map((entry) => ({
      household_id: context.householdId,
      definition_id: definition.id,
      occurrence_date: entry.occurrenceDate,
      amount_multiplier: entry.amountMultiplier,
      amount_override: entry.amountOverride ?? null,
      created_by: context.profileId
    }));
    const { error: datesError } = await adminSupabase.from("finance_cash_flow_specific_dates").insert(rows);
    if (datesError) {
      return { ok: false, error: "Kunne ikke lagre spesifikke datoer." };
    }
  }

  revalidatePath("/finance");
  return { ok: true };
}

/**
 * "Endre denne og fremtidige forekomster": closes the active definition the day
 * before `effectiveFrom` and creates a new version on the same series. Historical
 * occurrences already generated are preserved untouched (see docs/FINANCE_DOMAIN.md).
 */
export async function reviseFinanceCashFlowAction(input: unknown): Promise<FinanceActionResult> {
  const parsed = reviseFinanceCashFlowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: describeParseError(parsed, "Ugyldig endring.") };
  }

  const context = await resolveFinanceContext();
  if (!context) {
    return { ok: false, error: "Ingen aktiv husholdning." };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: activeDefinition } = await adminSupabase
    .from("finance_cash_flow_definitions")
    .select("*")
    .eq("series_id", parsed.data.seriesId)
    .eq("household_id", context.householdId)
    .eq("is_active", true)
    .maybeSingle();

  if (!activeDefinition) {
    return { ok: false, error: "Fant ikke aktiv kontantstrøm." };
  }

  const dayBefore = new Date(`${parsed.data.effectiveFrom}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const validToPreviousVersion = dayBefore.toISOString().slice(0, 10);

  const { error: closeError } = await adminSupabase
    .from("finance_cash_flow_definitions")
    .update({ valid_to: validToPreviousVersion, is_active: false })
    .eq("id", activeDefinition.id);

  if (closeError) {
    return { ok: false, error: "Kunne ikke avslutte forrige versjon." };
  }

  const { error: newVersionError } = await adminSupabase.from("finance_cash_flow_definitions").insert({
    household_id: context.householdId,
    series_id: activeDefinition.series_id,
    version_number: activeDefinition.version_number + 1,
    cash_flow_type: activeDefinition.cash_flow_type,
    category_id: activeDefinition.category_id,
    name: activeDefinition.name,
    description: activeDefinition.description,
    base_amount: parsed.data.baseAmount,
    owner_member_id: activeDefinition.owner_member_id,
    valid_from: parsed.data.effectiveFrom,
    valid_to: null,
    recurrence_type: activeDefinition.recurrence_type,
    day_of_month: activeDefinition.day_of_month,
    month_of_year: activeDefinition.month_of_year,
    quarter_start_month: activeDefinition.quarter_start_month,
    adjustment_type: activeDefinition.adjustment_type,
    assumption_series_id: activeDefinition.assumption_series_id,
    margin_rate: activeDefinition.margin_rate,
    floor_rate: activeDefinition.floor_rate,
    cap_rate: activeDefinition.cap_rate,
    apply_in_base_year: activeDefinition.apply_in_base_year,
    supersedes_definition_id: activeDefinition.id,
    created_by: context.profileId
  });

  revalidatePath("/finance");
  return newVersionError ? { ok: false, error: "Kunne ikke opprette ny versjon." } : { ok: true };
}

export async function runFinanceForecastAction(): Promise<FinanceActionResult> {
  const context = await resolveFinanceContext();
  if (!context) {
    return { ok: false, error: "Ingen aktiv husholdning." };
  }

  try {
    await runForecastForHousehold(context.householdId, context.profileId);
  } catch {
    return { ok: false, error: "Kunne ikke kjøre prognosen." };
  }

  revalidatePath("/finance");
  return { ok: true };
}
