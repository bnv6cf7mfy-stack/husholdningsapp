"use client";

import { useState } from "react";
import {
  createFinanceAccountAction,
  createFinanceCategoryAction,
  deleteFinanceAccountAction,
  editFinanceAccountAction,
  addFinanceBalanceSnapshotAction
} from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";
import {
  accountTypeLabels,
  buildCategoryOptions,
  buildMemberOptions,
  FELLES_OPTION_VALUE,
  formatAmount,
  NO_CATEGORY_OPTION_VALUE,
  parseAmountInput
} from "./finance-ui-helpers";

type FinanceActionResult = { ok: boolean; error?: string };

type FinanceSettingsTabProps = {
  overview: FinanceOverview;
  pending: boolean;
  runAction: (action: () => Promise<FinanceActionResult>) => void;
  setError: (message: string | null) => void;
};

export function FinanceSettingsTab({ overview, pending, runAction, setError }: FinanceSettingsTabProps) {
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [accountOwnerId, setAccountOwnerId] = useState(FELLES_OPTION_VALUE);
  const [drawPriority, setDrawPriority] = useState(0);

  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState(NO_CATEGORY_OPTION_VALUE);
  const [categoryScope, setCategoryScope] = useState<"income" | "expense" | "both">("both");

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountType, setEditAccountType] = useState("checking");
  const [editAccountOwnerId, setEditAccountOwnerId] = useState(FELLES_OPTION_VALUE);
  const [editAccountDrawPriority, setEditAccountDrawPriority] = useState(0);
  const [editAccountBalance, setEditAccountBalance] = useState("");

  const memberOptions = buildMemberOptions(overview.householdMembers);
  const topLevelCategories = overview.categories.filter((category) => !category.parentId);
  const categoryOptions = buildCategoryOptions(overview.categories);

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

  function handleStartEditAccount(account: FinanceOverview["accounts"][number]) {
    setEditingAccountId(account.id);
    setEditAccountName(account.name);
    setEditAccountType(account.accountType);
    setEditAccountOwnerId(account.ownerMemberId ?? FELLES_OPTION_VALUE);
    setEditAccountDrawPriority(account.drawPriority);
    setEditAccountBalance(account.latestBalance != null ? String(account.latestBalance) : "");
  }

  function handleSaveEditAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!editingAccountId) return;
    if (!editAccountName.trim()) {
      setError("Kontonavn er påkrevd.");
      return;
    }

    const accountId = editingAccountId;
    const balanceInput = editAccountBalance.trim();
    let newBalance: number | undefined;
    if (balanceInput) {
      newBalance = parseAmountInput(balanceInput);
      if (Number.isNaN(newBalance)) {
        setError("Ugyldig saldo. Bruk kun tall, f.eks. 71950,81.");
        return;
      }
    }

    runAction(async () => {
      const editResult = await editFinanceAccountAction({
        accountId,
        name: editAccountName.trim(),
        accountType: editAccountType,
        ownerMemberId: editAccountOwnerId || null,
        paymentEnabled: true,
        drawPriority: editAccountDrawPriority
      });
      if (!editResult.ok) return editResult;

      if (newBalance != null) {
        return addFinanceBalanceSnapshotAction({
          accountId,
          balanceDate: new Date().toISOString().slice(0, 10),
          balance: newBalance
        });
      }
      return editResult;
    });
    setEditingAccountId(null);
  }

  function handleDeleteAccount(accountId: string, name: string) {
    if (!window.confirm(`Slette kontoen «${name}»? Historiske saldopunkter beholdes.`)) {
      return;
    }
    runAction(() => deleteFinanceAccountAction({ accountId }));
    if (editingAccountId === accountId) setEditingAccountId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Kontoer</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overview.accounts.map((account) => (
            <li key={account.id} className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {account.name}{" "}
                  <span className="text-slate-400">
                    ({accountTypeLabels[account.accountType]}, {account.ownerName ?? "Felles"})
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">
                    {account.latestBalance != null ? formatAmount(account.latestBalance) : "Ingen saldo registrert"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStartEditAccount(account)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    Rediger
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(account.id, account.name)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200"
                  >
                    Slett
                  </button>
                </span>
              </div>

              {editingAccountId === account.id ? (
                <form onSubmit={handleSaveEditAccount} className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                  <label className="flex flex-col text-xs text-slate-500">
                    Kontonavn
                    <input
                      value={editAccountName}
                      onChange={(event) => setEditAccountName(event.target.value)}
                      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-slate-500">
                    Type
                    <select
                      value={editAccountType}
                      onChange={(event) => setEditAccountType(event.target.value)}
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
                      value={editAccountOwnerId}
                      onChange={(event) => setEditAccountOwnerId(event.target.value)}
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
                      value={editAccountDrawPriority}
                      onChange={(event) => setEditAccountDrawPriority(Number(event.target.value))}
                      className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-slate-500">
                    Ny saldo (valgfritt, i dag)
                    <input
                      value={editAccountBalance}
                      onChange={(event) => setEditAccountBalance(event.target.value)}
                      className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Uendret"
                    />
                  </label>
                  <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                    Lagre
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAccountId(null)}
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    Avbryt
                  </button>
                </form>
              ) : null}
            </li>
          ))}
          {overview.accounts.length === 0 ? <li className="text-sm text-slate-500">Ingen kontoer registrert.</li> : null}
        </ul>

        <form onSubmit={handleCreateAccount} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
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
            {pending ? "Lagrer …" : "Legg til konto"}
          </button>
        </form>
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
    </div>
  );
}
