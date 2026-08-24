"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFinanceBalanceSnapshotAction,
  createFinanceAccountAction,
  createFinanceCashFlowAction,
  createFinanceCategoryAction,
  reviseFinanceCashFlowAction,
  runFinanceForecastAction
} from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";
import { ForecastChart } from "./forecast-chart";

const accountTypeLabels: Record<string, string> = {
  checking: "Brukskonto",
  buffer: "Bufferkonto",
  savings: "Sparekonto",
  other: "Annen konto"
};

const recurrenceLabels: Record<string, string> = {
  once: "Én gang",
  monthly: "Månedlig",
  quarterly: "Kvartalsvis",
  annual: "Årlig",
  specific_dates: "Spesifikke datoer"
};

const adjustmentLabels: Record<string, string> = {
  none: "Ingen regulering",
  fixed_annual_percent: "Fast årlig prosent",
  cpi: "KPI",
  wage_growth: "Lønnsøkning",
  interest_rate: "Rente",
  custom_assumption: "Egendefinert"
};

const FELLES_OPTION_VALUE = "";
const NO_CATEGORY_OPTION_VALUE = "";

const currencyFormatter = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });

function formatAmount(value: number) {
  return currencyFormatter.format(value);
}

/** Accepts both "," and "." as decimal separator (Norwegian keyboards produce ","). */
function parseAmountInput(value: string): number {
  return Number(value.trim().replace(/\s/g, "").replace(",", "."));
}

export function FinanceDashboard({ overview }: { overview: FinanceOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [accountOwnerId, setAccountOwnerId] = useState(FELLES_OPTION_VALUE);
  const [drawPriority, setDrawPriority] = useState(0);

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

  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState(NO_CATEGORY_OPTION_VALUE);
  const [categoryScope, setCategoryScope] = useState<"income" | "expense" | "both">("both");

  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [editingEffectiveFrom, setEditingEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Noe gikk galt.");
        return;
      }
      router.refresh();
    });
  }

  function handleCreateAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!accountName.trim()) {
      setError("Kontonavn er påkrevd.");
      return;
    }
    runAction(() =>
      createFinanceAccountAction({
        name: accountName.trim(),
        accountType,
        ownerMemberId: accountOwnerId || null,
        currency: "NOK",
        paymentEnabled: true,
        drawPriority
      })
    );
    setAccountName("");
  }

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
    runAction(() =>
      addFinanceBalanceSnapshotAction({ accountId: snapshotAccountId, balanceDate: snapshotDate, balance })
    );
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
        dayOfMonth: cashFlowRecurrence === "monthly" || cashFlowRecurrence === "quarterly" ? cashFlowDayOfMonth : undefined,
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

  function handleCreateCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) {
      setError("Kategorinavn er påkrevd.");
      return;
    }
    runAction(() =>
      createFinanceCategoryAction({
        name: categoryName.trim(),
        parentId: categoryParentId || null,
        cashFlowScope: categoryScope
      })
    );
    setCategoryName("");
    setCategoryParentId(NO_CATEGORY_OPTION_VALUE);
    setCategoryScope("both");
  }

  function handleStartEdit(seriesId: string, currentAmount: number) {
    setEditingSeriesId(seriesId);
    setEditingAmount(String(currentAmount));
    setEditingEffectiveFrom(new Date().toISOString().slice(0, 10));
  }

  function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingSeriesId) return;
    const baseAmount = parseAmountInput(editingAmount);
    if (Number.isNaN(baseAmount)) {
      setError("Ugyldig beløp. Bruk kun tall, f.eks. 5000 eller 5000,50.");
      return;
    }
    runAction(() =>
      reviseFinanceCashFlowAction({
        seriesId: editingSeriesId,
        effectiveFrom: editingEffectiveFrom,
        baseAmount
      })
    );
    setEditingSeriesId(null);
  }

  function handleRunForecast() {
    runAction(() => runFinanceForecastAction());
  }

  const memberOptions = [{ id: FELLES_OPTION_VALUE, displayName: "Felles" }, ...overview.householdMembers];

  const topLevelCategories = overview.categories.filter((category) => !category.parentId);
  const categoryOptions = overview.categories
    .slice()
    .sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
    .map((category) => {
      const parent = category.parentId ? overview.categories.find((c) => c.id === category.parentId) : null;
      return {
        id: category.id,
        label: parent ? `${parent.name} \u203a ${category.name}` : category.name
      };
    });

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      ) : null}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Likviditetsprognose</p>
            <h2 className="mt-1 text-xl font-bold">Oversikt</h2>
          </div>
          <button
            type="button"
            onClick={handleRunForecast}
            disabled={pending}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Kjør prognose
          </button>
        </div>

        {overview.forecast ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Laveste saldo</dt>
                <dd className="font-semibold">{formatAmount(overview.forecast.lowestBalance)}</dd>
                <dd className="text-xs text-slate-400">{overview.forecast.lowestBalanceDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Minimum nødvendig buffer</dt>
                <dd className="font-semibold">{formatAmount(overview.forecast.minimumRequiredBuffer)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Anbefalt buffer</dt>
                <dd className="font-semibold">{formatAmount(overview.forecast.recommendedBuffer)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Kritiske dager</dt>
                <dd className="font-semibold">{overview.forecast.criticalDayCount}</dd>
              </div>
            </dl>
            <div className="mt-6 border-t border-slate-100 pt-6">
              <ForecastChart chart={overview.forecast.chart} />
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Ingen prognose kjørt ennå. Registrer minst én konto og kontantstrøm, og trykk «Kjør prognose».
          </p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Modellberegning, ikke finansrådgivning. Prognosehorisont: {overview.forecast?.forecastStart ?? "–"} til{" "}
          {overview.forecast?.forecastEnd ?? "–"}.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Registrer konto og saldo</h2>

        <form onSubmit={handleCreateAccount} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-slate-500">
            Kontonavn
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Brukskonto"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Type
            <select
              value={accountType}
              onChange={(event) => setAccountType(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {Object.entries(accountTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Hvem
            <select
              value={accountOwnerId}
              onChange={(event) => setAccountOwnerId(event.target.value)}
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
            Trekkprioritet
            <input
              type="number"
              min={0}
              value={drawPriority}
              onChange={(event) => setDrawPriority(Number(event.target.value))}
              className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Legg til konto
          </button>
        </form>

        {overview.accounts.length > 0 ? (
          <form onSubmit={handleAddSnapshot} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
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
              Registrer saldopunkt
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Kategorier</h2>
        <p className="mt-1 text-xs text-slate-500">
          Lag utgifts-/inntektskategorier, og velg en eksisterende kategori som overordnet for å lage en underkategori.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {overview.categories.length === 0 ? (
            <span className="text-sm text-slate-500">Ingen kategorier registrert.</span>
          ) : (
            categoryOptions.map((category) => (
              <span key={category.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {category.label}
              </span>
            ))
          )}
        </div>

        <form onSubmit={handleCreateCategory} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-slate-500">
            Navn
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Bolig / Mat"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Overordnet kategori (for underkategori)
            <select
              value={categoryParentId}
              onChange={(event) => setCategoryParentId(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value={NO_CATEGORY_OPTION_VALUE}>Ingen (hovedkategori)</option>
              {topLevelCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Gjelder
            <select
              value={categoryScope}
              onChange={(event) => setCategoryScope(event.target.value as "income" | "expense" | "both")}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="both">Begge</option>
              <option value="income">Inntekt</option>
              <option value="expense">Utgift</option>
            </select>
          </label>
          <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Legg til kategori
          </button>
        </form>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Registrer inntekt eller utgift</h2>

        <form onSubmit={handleCreateCashFlow} className="mt-4 flex flex-wrap items-end gap-3">
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
              className="mt-1 w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                className="mt-1 w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                  className="mt-1 w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                  className="mt-1 w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="3"
              />
            </label>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Legg til
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          KPI, lønnsøkning og rente krever en forutsetningsserie og kommer i en senere versjon (se docs/FINANCE_DOMAIN.md).
          Registreringsåret reguleres ikke automatisk.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Kontoer</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overview.accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2 text-sm">
              <span>
                {account.name}{" "}
                <span className="text-slate-400">
                  ({accountTypeLabels[account.accountType]}, {account.ownerName ?? "Felles"})
                </span>
              </span>
              <span className="font-semibold">
                {account.latestBalance != null ? formatAmount(account.latestBalance) : "Ingen saldo registrert"}
              </span>
            </li>
          ))}
          {overview.accounts.length === 0 ? <li className="text-sm text-slate-500">Ingen kontoer registrert.</li> : null}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Inntekter og utgifter</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overview.cashFlows.map((cashFlow) => (
            <li key={cashFlow.definitionId} className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {cashFlow.name}{" "}
                  <span className="text-slate-400">
                    ({cashFlow.cashFlowType === "income" ? "Inntekt" : "Utgift"}, {recurrenceLabels[cashFlow.recurrenceType]},{" "}
                    {adjustmentLabels[cashFlow.adjustmentType] ?? cashFlow.adjustmentType}, {cashFlow.ownerName ?? "Felles"}
                    {cashFlow.categoryName ? `, ${cashFlow.categoryName}` : ""})
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{formatAmount(cashFlow.baseAmount)}</span>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(cashFlow.seriesId, cashFlow.baseAmount)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    Rediger
                  </button>
                </span>
              </div>

              {editingSeriesId === cashFlow.seriesId ? (
                <form onSubmit={handleSaveEdit} className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                  <label className="flex flex-col text-xs text-slate-500">
                    Nytt beløp
                    <input
                      value={editingAmount}
                      onChange={(event) => setEditingAmount(event.target.value)}
                      className="mt-1 w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-slate-500">
                    Gjelder fra
                    <input
                      type="date"
                      value={editingEffectiveFrom}
                      onChange={(event) => setEditingEffectiveFrom(event.target.value)}
                      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                    Lagre
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSeriesId(null)}
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    Avbryt
                  </button>
                  <p className="w-full text-xs text-slate-400">
                    Endrer beløpet fra valgt dato og fremover. Historikk før denne datoen beholdes uendret.
                  </p>
                </form>
              ) : null}
            </li>
          ))}
          {overview.cashFlows.length === 0 ? (
            <li className="text-sm text-slate-500">Ingen inntekter eller utgifter registrert.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

