"use client";

import { useState } from "react";
import { addFinanceBalanceSnapshotAction, createFinanceCashFlowAction } from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";
import { buildCategoryOptions, buildMemberOptions, FELLES_OPTION_VALUE, NO_CATEGORY_OPTION_VALUE, parseAmountInput, recurrenceLabels } from "./finance-ui-helpers";

type FinanceActionResult = { ok: boolean; error?: string };

type FinanceInputTabProps = {
  overview: FinanceOverview;
  pending: boolean;
  runAction: (action: () => Promise<FinanceActionResult>) => void;
  setError: (message: string | null) => void;
};

export function FinanceInputTab({ overview, pending, runAction, setError }: FinanceInputTabProps) {
  const [snapshotAccountId, setSnapshotAccountId] = useState(overview.accounts[0]?.id ?? "");
  const [snapshotBalance, setSnapshotBalance] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [cashFlowType, setCashFlowType] = useState<"income" | "expense">("expense");
  const [cashFlowName, setCashFlowName] = useState("");
  const [cashFlowAmount, setCashFlowAmount] = useState("");
  const [cashFlowOwnerId, setCashFlowOwnerId] = useState(FELLES_OPTION_VALUE);
  const [cashFlowCategoryId, setCashFlowCategoryId] = useState(NO_CATEGORY_OPTION_VALUE);
  const [cashFlowRecurrence, setCashFlowRecurrence] = useState("monthly");
  const [cashFlowDayOfMonth, setCashFlowDayOfMonth] = useState(1);
  const [cashFlowMonthOfYear, setCashFlowMonthOfYear] = useState(1);
  const [cashFlowValidFrom, setCashFlowValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [cashFlowValidTo, setCashFlowValidTo] = useState("");
  const [cashFlowAdjustment, setCashFlowAdjustment] = useState("none");
  const [cashFlowAdjustmentPercent, setCashFlowAdjustmentPercent] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const memberOptions = buildMemberOptions(overview.householdMembers);
  const categoryOptions = buildCategoryOptions(overview.categories);

  function handleAddSnapshot(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshotAccountId) {
      setError("Velg en konto.");
      return;
    }
    const balance = parseAmountInput(snapshotBalance);
    if (Number.isNaN(balance)) {
      setError("Ugyldig saldo. Bruk kun tall, f.eks. 71950,81.");
      return;
    }
    runAction(() => addFinanceBalanceSnapshotAction({ accountId: snapshotAccountId, balanceDate: snapshotDate, balance }));
    setSnapshotBalance("");
  }

  function handleCreateCashFlow(event: React.FormEvent) {
    event.preventDefault();
    const baseAmount = parseAmountInput(cashFlowAmount);
    if (!cashFlowName.trim()) {
      setError("Navn er påkrevd.");
      return;
    }
    if (Number.isNaN(baseAmount)) {
      setError("Ugyldig beløp. Bruk kun tall, f.eks. 5000 eller 5000,50.");
      return;
    }

    let fixedAnnualPercent: number | undefined;
    if (cashFlowAdjustment === "fixed_annual_percent") {
      const percent = parseAmountInput(cashFlowAdjustmentPercent);
      if (Number.isNaN(percent)) {
        setError("Ugyldig prosentsats. Bruk kun tall, f.eks. 3 eller 3,5.");
        return;
      }
      fixedAnnualPercent = percent / 100;
    }

    runAction(() =>
      createFinanceCashFlowAction({
        cashFlowType,
        name: cashFlowName.trim(),
        baseAmount,
        ownerMemberId: cashFlowOwnerId || null,
        categoryId: cashFlowCategoryId || null,
        validFrom: cashFlowValidFrom,
        validTo: cashFlowValidTo || null,
        recurrenceType: cashFlowRecurrence,
        dayOfMonth:
          cashFlowRecurrence === "monthly" || cashFlowRecurrence === "quarterly" || cashFlowRecurrence === "annual"
            ? cashFlowDayOfMonth
            : undefined,
        monthOfYear: cashFlowRecurrence === "annual" ? cashFlowMonthOfYear : undefined,
        adjustmentType: cashFlowAdjustment,
        fixedAnnualPercent,
        specificDates: []
      })
    );
    setCashFlowName("");
    setCashFlowAmount("");
    setCashFlowValidTo("");
    setCashFlowAdjustment("none");
    setCashFlowAdjustmentPercent("");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Registrer inntekt eller utgift</h2>

        <form onSubmit={handleCreateCashFlow} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <label className="flex flex-col text-xs text-slate-500">
            Type
            <select
              value={cashFlowType}
              onChange={(event) => setCashFlowType(event.target.value as "income" | "expense")}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="income">Inntekt</option>
              <option value="expense">Utgift</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Navn
            <input
              value={cashFlowName}
              onChange={(event) => setCashFlowName(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Lønn / Husleie"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Beløp
            <input
              value={cashFlowAmount}
              onChange={(event) => setCashFlowAmount(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Kategori
            <select
              value={cashFlowCategoryId}
              onChange={(event) => setCashFlowCategoryId(event.target.value)}
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
              value={cashFlowRecurrence}
              onChange={(event) => setCashFlowRecurrence(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {Object.entries(recurrenceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {cashFlowRecurrence === "monthly" || cashFlowRecurrence === "quarterly" ? (
            <label className="flex flex-col text-xs text-slate-500">
              Dag i måneden
              <input
                type="number"
                min={1}
                max={31}
                value={cashFlowDayOfMonth}
                onChange={(event) => setCashFlowDayOfMonth(Number(event.target.value))}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          {cashFlowRecurrence === "annual" ? (
            <>
              <label className="flex flex-col text-xs text-slate-500">
                Måned
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={cashFlowMonthOfYear}
                  onChange={(event) => setCashFlowMonthOfYear(Number(event.target.value))}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs text-slate-500">
                Dag
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cashFlowDayOfMonth}
                  onChange={(event) => setCashFlowDayOfMonth(Number(event.target.value))}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}
          <label className="flex flex-col text-xs text-slate-500">
            Gyldig fra
            <input
              type="date"
              value={cashFlowValidFrom}
              onChange={(event) => setCashFlowValidFrom(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="col-span-full flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowMoreOptions((current) => !current)}
              className="w-fit text-xs font-semibold text-primary underline"
            >
              {showMoreOptions ? "Skjul flere valg" : "Flere valg (hvem, gyldig til, regulering)"}
            </button>

            {showMoreOptions ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                <label className="flex flex-col text-xs text-slate-500">
                  Hvem
                  <select
                    value={cashFlowOwnerId}
                    onChange={(event) => setCashFlowOwnerId(event.target.value)}
                    className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {memberOptions.map((member) => (
                      <option key={member.id || "felles"} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-slate-500">
                  Gyldig til (valgfritt)
                  <input
                    type="date"
                    value={cashFlowValidTo}
                    onChange={(event) => setCashFlowValidTo(event.target.value)}
                    className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs text-slate-500">
                  Regulering
                  <select
                    value={cashFlowAdjustment}
                    onChange={(event) => setCashFlowAdjustment(event.target.value)}
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
                {cashFlowAdjustment === "fixed_annual_percent" ? (
                  <label className="flex flex-col text-xs text-slate-500">
                    Prosent per år
                    <input
                      value={cashFlowAdjustmentPercent}
                      onChange={(event) => setCashFlowAdjustmentPercent(event.target.value)}
                      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="3"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="col-span-full">
            <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {pending ? "Lagrer …" : "Legg til"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          KPI, lønnsøkning og rente krever en forutsetningsserie og kommer i en senere versjon. Registreringsåret reguleres ikke
          automatisk. Kontoer og kategorier opprettes under «Innstillinger».
        </p>
      </section>

      {overview.accounts.length > 0 ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-bold">Registrer saldopunkt</h2>
          <form onSubmit={handleAddSnapshot} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-slate-500">
              Konto
              <select
                value={snapshotAccountId}
                onChange={(event) => setSnapshotAccountId(event.target.value)}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {overview.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-slate-500">
              Saldo
              <input
                value={snapshotBalance}
                onChange={(event) => setSnapshotBalance(event.target.value)}
                className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="0"
              />
            </label>
            <label className="flex flex-col text-xs text-slate-500">
              Dato
              <input
                type="date"
                value={snapshotDate}
                onChange={(event) => setSnapshotDate(event.target.value)}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {pending ? "Lagrer …" : "Registrer saldopunkt"}
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-slate-500">Opprett en konto under «Innstillinger» før du kan registrere saldopunkter.</p>
      )}
    </div>
  );
}
