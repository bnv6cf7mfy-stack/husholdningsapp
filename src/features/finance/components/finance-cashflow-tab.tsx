"use client";

import { useState } from "react";
import { createFinanceCashFlowAction, createFinanceCategoryAction, deleteFinanceCashFlowAction, updateFinanceCashFlowAction } from "@/features/finance/actions";
import type { FinanceCashFlowSummary, FinanceOverview } from "@/features/finance/queries";
import { adjustmentLabels, buildCategoryOptions, formatAmount, NO_CATEGORY_OPTION_VALUE, recurrenceLabels } from "./finance-ui-helpers";
import { Modal } from "./modal";
import { CashFlowForm, cashFlowFormValuesFromEntry, defaultCashFlowFormValues, type CashFlowFormValues } from "./cash-flow-form";

type FinanceActionResult = { ok: boolean; error?: string };

type FinanceCashFlowTabProps = {
  overview: FinanceOverview;
  pending: boolean;
  runAction: (action: () => Promise<FinanceActionResult>) => void;
  setError: (message: string | null) => void;
};

export function FinanceCashFlowTab({ overview, pending, runAction, setError }: FinanceCashFlowTabProps) {
  const [createValues, setCreateValues] = useState<CashFlowFormValues | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ entry: FinanceCashFlowSummary; values: CashFlowFormValues } | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState(NO_CATEGORY_OPTION_VALUE);
  const [categoryScope, setCategoryScope] = useState<"income" | "expense" | "both">("both");

  const topLevelCategories = overview.categories.filter((category) => !category.parentId);
  const categoryOptions = buildCategoryOptions(overview.categories);

  function handleOpenCreate() {
    setError(null);
    setCreateValues(defaultCashFlowFormValues(overview.currentMemberId));
  }

  function handleOpenEdit(entry: FinanceCashFlowSummary) {
    setError(null);
    setEditingEntry({ entry, values: cashFlowFormValuesFromEntry(entry, new Date().toISOString().slice(0, 10)) });
  }

  function handleDeleteCashFlow(seriesId: string, name: string) {
    if (!window.confirm(`Slette «${name}»? Historikk beholdes, men den vil ikke lenger inngå i fremtidige prognoser.`)) {
      return;
    }
    runAction(() => deleteFinanceCashFlowAction({ seriesId }));
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

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Inntekter og utgifter</h2>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Registrer ny post
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          «Rediger» endrer alle felt fra en valgt dato og fremover; historikk før datoen beholdes. «Slett» stopper fremtidige
          forekomster, men beholder historikken.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {overview.cashFlows.map((cashFlow) => (
            <li key={cashFlow.definitionId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2 text-sm">
              <span>
                {cashFlow.name}{" "}
                <span className="text-slate-400">
                  ({cashFlow.cashFlowType === "income" ? "Inntekt" : "Utgift"}, {recurrenceLabels[cashFlow.recurrenceType]},{" "}
                  {adjustmentLabels[cashFlow.adjustmentType] ?? cashFlow.adjustmentType}, {cashFlow.ownerName ?? "Ukjent"}
                  {cashFlow.categoryName ? `, ${cashFlow.categoryName}` : ""})
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-semibold">{formatAmount(cashFlow.baseAmount)}</span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(cashFlow)}
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
            </li>
          ))}
          {overview.cashFlows.length === 0 ? (
            <li className="text-sm text-slate-500">Ingen inntekter eller utgifter registrert ennå.</li>
          ) : null}
        </ul>
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
            {pending ? "Lagrer …" : "Legg til kategori"}
          </button>
        </form>
      </section>

      {createValues ? (
        <Modal title="Registrer ny post" onClose={() => setCreateValues(null)}>
          <CashFlowForm
            mode="create"
            values={createValues}
            onChange={setCreateValues}
            categories={overview.categories}
            members={overview.householdMembers}
            pending={pending}
            onCancel={() => setCreateValues(null)}
            onSubmit={(payload) => {
              runAction(() => createFinanceCashFlowAction({ ...payload, specificDates: [] }));
              setCreateValues(null);
            }}
          />
        </Modal>
      ) : null}

      {editingEntry ? (
        <Modal title={`Rediger «${editingEntry.entry.name}»`} onClose={() => setEditingEntry(null)}>
          <CashFlowForm
            mode="edit"
            values={editingEntry.values}
            onChange={(values) => setEditingEntry({ entry: editingEntry.entry, values })}
            categories={overview.categories}
            members={overview.householdMembers}
            pending={pending}
            onCancel={() => setEditingEntry(null)}
            onSubmit={(payload) => {
              runAction(() =>
                updateFinanceCashFlowAction({
                  seriesId: editingEntry.entry.seriesId,
                  effectiveFrom: payload.validFrom,
                  cashFlowType: payload.cashFlowType,
                  name: payload.name,
                  baseAmount: payload.baseAmount,
                  ownerMemberId: payload.ownerMemberId,
                  categoryId: payload.categoryId,
                  validTo: payload.validTo,
                  recurrenceType: payload.recurrenceType,
                  dayOfMonth: payload.dayOfMonth,
                  monthOfYear: payload.monthOfYear,
                  adjustmentType: payload.adjustmentType,
                  fixedAnnualPercent: payload.fixedAnnualPercent
                })
              );
              setEditingEntry(null);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
