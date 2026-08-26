"use client";

import { useState } from "react";
import type { FinanceCashFlowSummary, FinanceCategoryOption, FinanceHouseholdMemberOption } from "@/features/finance/queries";
import { buildCategoryOptions, NO_CATEGORY_OPTION_VALUE, parseAmountInput, recurrenceLabels } from "./finance-ui-helpers";

export type CashFlowFormValues = {
  cashFlowType: "income" | "expense";
  name: string;
  baseAmount: string;
  ownerMemberId: string;
  categoryId: string;
  recurrenceType: string;
  dayOfMonth: number;
  monthOfYear: number;
  validFrom: string;
  validTo: string;
  adjustmentType: string;
  adjustmentPercent: string;
};

export function defaultCashFlowFormValues(currentMemberId: string | null): CashFlowFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    cashFlowType: "expense",
    name: "",
    baseAmount: "",
    ownerMemberId: currentMemberId ?? "",
    categoryId: NO_CATEGORY_OPTION_VALUE,
    recurrenceType: "monthly",
    dayOfMonth: 1,
    monthOfYear: 1,
    validFrom: today,
    validTo: "",
    adjustmentType: "none",
    adjustmentPercent: ""
  };
}

export function cashFlowFormValuesFromEntry(entry: FinanceCashFlowSummary, effectiveFrom: string): CashFlowFormValues {
  return {
    cashFlowType: entry.cashFlowType,
    name: entry.name,
    baseAmount: String(entry.baseAmount),
    ownerMemberId: entry.ownerMemberId ?? "",
    categoryId: entry.categoryId ?? NO_CATEGORY_OPTION_VALUE,
    recurrenceType: entry.recurrenceType,
    dayOfMonth: entry.dayOfMonth ?? 1,
    monthOfYear: entry.monthOfYear ?? 1,
    validFrom: effectiveFrom,
    validTo: entry.validTo ?? "",
    adjustmentType: entry.adjustmentType,
    adjustmentPercent: entry.marginRate != null ? String(entry.marginRate * 100) : ""
  };
}

type CashFlowFormProps = {
  mode: "create" | "edit";
  values: CashFlowFormValues;
  onChange: (values: CashFlowFormValues) => void;
  categories: FinanceCategoryOption[];
  members: FinanceHouseholdMemberOption[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    cashFlowType: "income" | "expense";
    name: string;
    baseAmount: number;
    ownerMemberId: string;
    categoryId: string | null;
    recurrenceType: string;
    dayOfMonth?: number;
    monthOfYear?: number;
    validFrom: string;
    validTo: string | null;
    adjustmentType: string;
    fixedAnnualPercent?: number;
  }) => void;
};

export function CashFlowForm({ mode, values, onChange, categories, members, pending, onCancel, onSubmit }: CashFlowFormProps) {
  const [error, setLocalError] = useState<string | null>(null);
  const categoryOptions = buildCategoryOptions(categories);

  function update<K extends keyof CashFlowFormValues>(key: K, value: CashFlowFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (!values.name.trim()) {
      setLocalError("Navn er påkrevd.");
      return;
    }
    if (!values.ownerMemberId) {
      setLocalError("Velg hvem posten gjelder for.");
      return;
    }
    const baseAmount = parseAmountInput(values.baseAmount);
    if (Number.isNaN(baseAmount)) {
      setLocalError("Ugyldig beløp. Bruk kun tall, f.eks. 5000 eller 5000,50.");
      return;
    }

    let fixedAnnualPercent: number | undefined;
    if (values.adjustmentType === "fixed_annual_percent") {
      const percent = parseAmountInput(values.adjustmentPercent);
      if (Number.isNaN(percent)) {
        setLocalError("Ugyldig prosentsats. Bruk kun tall, f.eks. 3 eller 3,5.");
        return;
      }
      fixedAnnualPercent = percent / 100;
    }

    onSubmit({
      cashFlowType: values.cashFlowType,
      name: values.name.trim(),
      baseAmount,
      ownerMemberId: values.ownerMemberId,
      categoryId: values.categoryId || null,
      recurrenceType: values.recurrenceType,
      dayOfMonth:
        values.recurrenceType === "monthly" || values.recurrenceType === "quarterly" || values.recurrenceType === "annual"
          ? values.dayOfMonth
          : undefined,
      monthOfYear: values.recurrenceType === "annual" ? values.monthOfYear : undefined,
      validFrom: values.validFrom,
      validTo: values.validTo || null,
      adjustmentType: values.adjustmentType,
      fixedAnnualPercent
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="flex flex-col text-xs text-slate-500">
          Type
          <select
            value={values.cashFlowType}
            onChange={(event) => update("cashFlowType", event.target.value as "income" | "expense")}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="income">Inntekt</option>
            <option value="expense">Utgift</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Navn
          <input
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Lønn / Husleie"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Beløp
          <input
            value={values.baseAmount}
            onChange={(event) => update("baseAmount", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="0"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Hvem *
          <select
            value={values.ownerMemberId}
            onChange={(event) => update("ownerMemberId", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            required
          >
            <option value="" disabled>
              Velg person
            </option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Kategori
          <select
            value={values.categoryId}
            onChange={(event) => update("categoryId", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value={NO_CATEGORY_OPTION_VALUE}>Ingen</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Gjentakelse
          <select
            value={values.recurrenceType}
            onChange={(event) => update("recurrenceType", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {Object.entries(recurrenceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {values.recurrenceType === "monthly" || values.recurrenceType === "quarterly" ? (
          <label className="flex flex-col text-xs text-slate-500">
            Dag i måneden
            <input
              type="number"
              min={1}
              max={31}
              value={values.dayOfMonth}
              onChange={(event) => update("dayOfMonth", Number(event.target.value))}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        {values.recurrenceType === "annual" ? (
          <>
            <label className="flex flex-col text-xs text-slate-500">
              Måned
              <input
                type="number"
                min={1}
                max={12}
                value={values.monthOfYear}
                onChange={(event) => update("monthOfYear", Number(event.target.value))}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs text-slate-500">
              Dag
              <input
                type="number"
                min={1}
                max={31}
                value={values.dayOfMonth}
                onChange={(event) => update("dayOfMonth", Number(event.target.value))}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </>
        ) : null}
        <label className="flex flex-col text-xs text-slate-500">
          Gyldig fra
          <input
            type="date"
            value={values.validFrom}
            onChange={(event) => update("validFrom", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Gyldig til (valgfritt)
          <span className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={values.validTo}
              onChange={(event) => update("validTo", event.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {values.validTo ? (
              <button
                type="button"
                onClick={() => update("validTo", "")}
                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                aria-label="Fjern dato"
                title="Fjern dato"
              >
                Fjern
              </button>
            ) : null}
          </span>
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Regulering
          <select
            value={values.adjustmentType}
            onChange={(event) => update("adjustmentType", event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="none">Ingen</option>
            <option value="fixed_annual_percent">Fast årlig prosent</option>
            <option value="cpi" disabled>
              KPI (kommer snart)
            </option>
            <option value="wage_growth" disabled>
              Lønnsøkning (kommer snart)
            </option>
            <option value="interest_rate" disabled>
              Rente (kommer snart)
            </option>
          </select>
        </label>
        {values.adjustmentType === "fixed_annual_percent" ? (
          <label className="flex flex-col text-xs text-slate-500">
            Prosent per år
            <input
              value={values.adjustmentPercent}
              onChange={(event) => update("adjustmentPercent", event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="3"
            />
          </label>
        ) : null}
      </div>

      {mode === "edit" ? (
        <p className="text-xs text-slate-400">
          Endringene gjelder fra og med «Gyldig fra». Historikk før denne datoen beholdes uendret.
        </p>
      ) : null}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          {pending ? "Lagrer …" : mode === "create" ? "Registrer" : "Lagre endringer"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
          Avbryt
        </button>
      </div>
    </form>
  );
}
