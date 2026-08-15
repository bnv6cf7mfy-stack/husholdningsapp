"use client";

import { useActionState, useState } from "react";
import { Users, Link2, Copy, Check, Crown, User } from "lucide-react";
import { createInviteAction, type InviteFormState } from "@/features/household/actions";
import type { HouseholdPageData } from "@/features/household/queries";

const roleLabels: Record<string, string> = {
  owner: "Eier",
  adult: "Voksen",
  member: "Medlem"
};

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="size-3.5 text-amber-500" />,
  adult: <User className="size-3.5 text-slate-400" />,
  member: <User className="size-3.5 text-slate-400" />
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

const initialState: InviteFormState = {};

export function HouseholdSettings({ data }: { data: HouseholdPageData }) {
  const [state, formAction, isPending] = useActionState(createInviteAction, initialState);
  const [copied, setCopied] = useState(false);

  const inviteUrl = state.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${state.token}`
    : null;

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Husholdning</p>
        <h1 className="mt-2 text-3xl font-bold">{data.householdName}</h1>
      </section>

      {/* Members */}
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="size-5 text-slate-500" />
          <h2 className="text-lg font-semibold">Medlemmer</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {data.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                {roleIcons[member.role]}
                <span className="font-medium">{member.displayName}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                  {roleLabels[member.role]}
                </span>
                <span>{formatDate(member.joinedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Invite */}
      {data.currentRole === "owner" && (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="size-5 text-slate-500" />
            <h2 className="text-lg font-semibold">Inviter partner</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Generer en invitasjonslenke og send den til den du vil ha med. Lenken er gyldig i 7 dager.
          </p>

          {!inviteUrl ? (
            <form action={formAction}>
              {state.error && (
                <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{state.error}</p>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isPending ? "Genererer…" : "Generer invitasjonslenke"}
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <span className="min-w-0 flex-1 truncate text-sm font-mono text-slate-700">{inviteUrl}</span>
              <button
                type="button"
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                {copied ? "Kopiert!" : "Kopier"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
