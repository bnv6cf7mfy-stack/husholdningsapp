"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFinanceBalanceSnapshotAction,
  createFinanceAccountAction,
  createFinanceCashFlowAction,
  runFinanceForecastAction
} from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";

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

const currencyFormatter = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });

function formatAmount(value: number) {
  return currencyFormatter.format(value);
}

export function FinanceDashboard({ overview }: { overview: FinanceOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [drawPriority, setDrawPriority] = useState(0);

  const [snapshotAccountId, setSnapshotAccountId] = useState(overview.accounts[0]?.id ?? "");
  const [snapshotBalance, setSnapshotBalance] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [cashFlowType, setCashFlowType] = useState<"income" | "expense">("expense");
  const [cashFlowName, setCashFlowName] = useState("");
  const [cashFlowAmount, setCashFlowAmount] = useState("");
  const [cashFlowRecurrence, setCashFlowRecurrence] = useState("monthly");
  const [cashFlowDayOfMonth, setCashFlowDayOfMonth] = useState(1);
  const [cashFlowValidFrom, setCashFlowValidFrom] = useState(() => new Date().toISOString().slice(0, 10));

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
    if (!accountName.trim()) return;
    runAction(() =>
      createFinanceAccountAction({
        name: accountName.trim(),
        accountType,
        currency: "NOK",
        paymentEnabled: true,
        drawPriority
      })
    );
    setAccountName("");
  }

  function handleAddSnapshot(event: React.FormEvent) {
    event.preventDefault();
    const balance = Number(snapshotBalance);
    if (!snapshotAccountId || Number.isNaN(balance)) return;
    runAction(() =>
      addFinanceBalanceSnapshotAction({ accountId: snapshotAccountId, balanceDate: snapshotDate, balance })
    );
    setSnapshotBalance("");
  }

  function handleCreateCashFlow(event: React.FormEvent) {
    event.preventDefault();
    const baseAmount = Number(cashFlowAmount);
    if (!cashFlowName.trim() || Number.isNaN(baseAmount)) return;
    runAction(() =>
      createFinanceCashFlowAction({
        cashFlowType,
        name: cashFlowName.trim(),
        baseAmount,
        validFrom: cashFlowValidFrom,
        recurrenceType: cashFlowRecurrence,
        dayOfMonth: cashFlowRecurrence === "monthly" || cashFlowRecurrence === "quarterly" ? cashFlowDayOfMonth : undefined,
        monthOfYear: cashFlowRecurrence === "annual" ? 1 : undefined,
        specificDates: []
      })
    );
    setCashFlowName("");
    setCashFlowAmount("");
  }

  function handleRunForecast() {
    runAction(() => runFinanceForecastAction());
  }

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
        <h2 className="text-lg font-bold">Kontoer</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overview.accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2 text-sm">
              <span>
                {account.name} <span className="text-slate-400">({accountTypeLabels[account.accountType]})</span>
              </span>
              <span className="font-semibold">
                {account.latestBalance != null ? formatAmount(account.latestBalance) : "Ingen saldo registrert"}
              </span>
            </li>
          ))}
          {overview.accounts.length === 0 ? <li className="text-sm text-slate-500">Ingen kontoer registrert.</li> : null}
        </ul>

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
        <h2 className="text-lg font-bold">Inntekter og utgifter</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overview.cashFlows.map((cashFlow) => (
            <li key={cashFlow.definitionId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2 text-sm">
              <span>
                {cashFlow.name}{" "}
                <span className="text-slate-400">
                  ({cashFlow.cashFlowType === "income" ? "Inntekt" : "Utgift"}, {recurrenceLabels[cashFlow.recurrenceType]})
                </span>
              </span>
              <span className="font-semibold">{formatAmount(cashFlow.baseAmount)}</span>
            </li>
          ))}
          {overview.cashFlows.length === 0 ? (
            <li className="text-sm text-slate-500">Ingen inntekter eller utgifter registrert.</li>
          ) : null}
        </ul>

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
            Gjentakelse
            <select
              value={cashFlowRecurrence}
              onChange={(event) => setCashFlowRecurrence(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {Object.entries(recurrenceLabels)
                .filter(([value]) => value !== "specific_dates")
                .map(([value, label]) => (
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
          <label className="flex flex-col text-xs text-slate-500">
            Gyldig fra
            <input
              type="date"
              value={cashFlowValidFrom}
              onChange={(event) => setCashFlowValidFrom(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Legg til
          </button>
        </form>
      </section>
    </div>
  );
}
