"use client";

import { useState } from "react";
import { createFinanceAccountAction, deleteFinanceAccountAction, editFinanceAccountAction, addFinanceBalanceSnapshotAction } from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";
import { accountTypeLabels, buildMemberOptions, FELLES_OPTION_VALUE, formatAmount, parseAmountInput } from "./finance-ui-helpers";
import { Modal } from "./modal";

type FinanceActionResult = { ok: boolean; error?: string };

type FinanceAccountTabProps = {
  overview: FinanceOverview;
  pending: boolean;
  runAction: (action: () => Promise<FinanceActionResult>) => void;
  setError: (message: string | null) => void;
};

type AccountFormValues = {
  name: string;
  accountType: string;
  ownerMemberId: string;
  drawPriority: number;
  balance: string;
};

function emptyAccountForm(): AccountFormValues {
  return { name: "", accountType: "checking", ownerMemberId: FELLES_OPTION_VALUE, drawPriority: 0, balance: "" };
}

export function FinanceAccountTab({ overview, pending, runAction, setError }: FinanceAccountTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<AccountFormValues>(emptyAccountForm());

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<AccountFormValues>(emptyAccountForm());

  const memberOptions = buildMemberOptions(overview.householdMembers);

  function handleOpenCreate() {
    setError(null);
    setCreateValues(emptyAccountForm());
    setIsCreateOpen(true);
  }

  function handleCreateAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!createValues.name.trim()) {
      setError("Kontonavn er påkrevd.");
      return;
    }
    runAction(() =>
      createFinanceAccountAction({
        name: createValues.name.trim(),
        accountType: createValues.accountType,
        ownerMemberId: createValues.ownerMemberId || null,
        currency: "NOK",
        paymentEnabled: true,
        drawPriority: createValues.drawPriority
      })
    );
    setIsCreateOpen(false);
  }

  function handleStartEditAccount(account: FinanceOverview["accounts"][number]) {
    setError(null);
    setEditingAccountId(account.id);
    setEditValues({
      name: account.name,
      accountType: account.accountType,
      ownerMemberId: account.ownerMemberId ?? FELLES_OPTION_VALUE,
      drawPriority: account.drawPriority,
      balance: account.latestBalance != null ? String(account.latestBalance) : ""
    });
  }

  function handleSaveEditAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!editingAccountId) return;
    if (!editValues.name.trim()) {
      setError("Kontonavn er påkrevd.");
      return;
    }

    const accountId = editingAccountId;
    const balanceInput = editValues.balance.trim();
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
        name: editValues.name.trim(),
        accountType: editValues.accountType,
        ownerMemberId: editValues.ownerMemberId || null,
        paymentEnabled: true,
        drawPriority: editValues.drawPriority
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
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Kontoer</h2>
        <button type="button" onClick={handleOpenCreate} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
          Legg til ny konto
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
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
                    value={editValues.name}
                    onChange={(event) => setEditValues({ ...editValues, name: event.target.value })}
                    className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs text-slate-500">
                  Type
                  <select
                    value={editValues.accountType}
                    onChange={(event) => setEditValues({ ...editValues, accountType: event.target.value })}
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
                    value={editValues.ownerMemberId}
                    onChange={(event) => setEditValues({ ...editValues, ownerMemberId: event.target.value })}
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
                    value={editValues.drawPriority}
                    onChange={(event) => setEditValues({ ...editValues, drawPriority: Number(event.target.value) })}
                    className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs text-slate-500">
                  Ny saldo (valgfritt, i dag)
                  <input
                    value={editValues.balance}
                    onChange={(event) => setEditValues({ ...editValues, balance: event.target.value })}
                    className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Uendret"
                  />
                </label>
                <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                  {pending ? "Lagrer …" : "Lagre"}
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
        {overview.accounts.length === 0 ? <li className="text-sm text-slate-500">Ingen kontoer registrert ennå.</li> : null}
      </ul>

      {isCreateOpen ? (
        <Modal title="Legg til ny konto" onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-xs text-slate-500">
                Kontonavn
                <input
                  value={createValues.name}
                  onChange={(event) => setCreateValues({ ...createValues, name: event.target.value })}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Brukskonto"
                  autoFocus
                />
              </label>
              <label className="flex flex-col text-xs text-slate-500">
                Type
                <select
                  value={createValues.accountType}
                  onChange={(event) => setCreateValues({ ...createValues, accountType: event.target.value })}
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
                  value={createValues.ownerMemberId}
                  onChange={(event) => setCreateValues({ ...createValues, ownerMemberId: event.target.value })}
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
                  value={createValues.drawPriority}
                  onChange={(event) => setCreateValues({ ...createValues, drawPriority: Number(event.target.value) })}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                {pending ? "Lagrer …" : "Registrer konto"}
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Avbryt
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
