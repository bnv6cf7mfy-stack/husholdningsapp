"use client";

import { useState } from "react";
import { deleteFinanceCashFlowAction, reviseFinanceCashFlowAction } from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";
import { adjustmentLabels, formatAmount, parseAmountInput, recurrenceLabels } from "./finance-ui-helpers";

type FinanceActionResult = { ok: boolean; error?: string };

type FinanceAdminTabProps = {
  overview: FinanceOverview;
  pending: boolean;
  runAction: (action: () => Promise<FinanceActionResult>) => void;
  setError: (message: string | null) => void;
};

export function FinanceAdminTab({ overview, pending, runAction, setError }: FinanceAdminTabProps) {
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [editingEffectiveFrom, setEditingEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));

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

  function handleDeleteCashFlow(seriesId: string, name: string) {
    if (!window.confirm(`Slette «${name}»? Historikk beholdes, men den vil ikke lenger inngå i fremtidige prognoser.`)) {
      return;
    }
    runAction(() => deleteFinanceCashFlowAction({ seriesId }));
    if (editingSeriesId === seriesId) setEditingSeriesId(null);
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-lg font-bold">Inntekter og utgifter</h2>
      <p className="mt-1 text-xs text-slate-500">
        Rediger endrer beløpet fra en valgt dato og fremover; historikk før datoen beholdes. Slett stopper fremtidige forekomster, men
        beholder historikken.
      </p>
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
                <button
                  type="button"
                  onClick={() => handleDeleteCashFlow(cashFlow.seriesId, cashFlow.name)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200"
                >
                  Slett
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
              </form>
            ) : null}
          </li>
        ))}
        {overview.cashFlows.length === 0 ? (
          <li className="text-sm text-slate-500">Ingen inntekter eller utgifter registrert. Legg til under «Input».</li>
        ) : null}
      </ul>
    </section>
  );
}
