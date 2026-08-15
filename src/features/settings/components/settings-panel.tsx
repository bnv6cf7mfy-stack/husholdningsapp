"use client";

import { useActionState, useState } from "react";
import {
  Users,
  Link2,
  Copy,
  Check,
  Crown,
  User,
  Bell,
  Settings2
} from "lucide-react";
import { createInviteAction, type InviteFormState } from "@/features/household/actions";
import type { HouseholdPageData } from "@/features/household/queries";
import { updateProfileAction, type UpdateProfileState } from "@/features/settings/actions";
import { PushNotificationToggle } from "@/features/notifications/components/push-notification-toggle";

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

const inviteInitialState: InviteFormState = {};
const profileInitialState: UpdateProfileState = {};

type SettingsPanelProps = {
  householdData: HouseholdPageData | null;
  currentDisplayName: string;
  currentEmail: string;
};

export function SettingsPanel({
  householdData,
  currentDisplayName,
  currentEmail
}: SettingsPanelProps) {
  const [inviteState, inviteFormAction, isInvitePending] = useActionState(
    createInviteAction,
    inviteInitialState
  );
  const [profileState, profileFormAction, isProfilePending] = useActionState(
    updateProfileAction,
    profileInitialState
  );

  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteState.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteState.token}`
    : null;

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="size-5 text-slate-500" />
          <h2 className="text-lg font-semibold">Brukerprofil</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Innlogget som <span className="font-medium text-slate-700">{currentEmail}</span>
        </p>
        <form action={profileFormAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Visningsnavn</span>
            <input
              name="displayName"
              type="text"
              required
              defaultValue={currentDisplayName}
              maxLength={120}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {profileState.error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {profileState.error}
            </p>
          )}
          {profileState.success && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {profileState.success}
            </p>
          )}
          <button
            type="submit"
            disabled={isProfilePending}
            className="self-start rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {isProfilePending ? "Lagrer…" : "Lagre navn"}
          </button>
        </form>
      </section>

      {/* Notifications */}
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="size-5 text-slate-500" />
          <h2 className="text-lg font-semibold">Varslinger</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Skru på push-varslinger for denne enheten. Du vil bli varslet om nye handleliste-varer og
          meldinger fra husholdningen.
        </p>
        <PushNotificationToggle />
      </section>

      {/* Household */}
      {householdData && (
        <>
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="mb-4 flex items-center gap-2">
              <Users className="size-5 text-slate-500" />
              <h2 className="text-lg font-semibold">Husholdning: {householdData.householdName}</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {householdData.members.map((member) => (
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

          {householdData.currentRole === "owner" && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="mb-4 flex items-center gap-2">
                <Link2 className="size-5 text-slate-500" />
                <h2 className="text-lg font-semibold">Inviter til husholdningen</h2>
              </div>
              <p className="mb-4 text-sm text-slate-500">
                Generer en lenke og send den til den du vil invitere. Gyldig i 7 dager.
              </p>

              {!inviteUrl ? (
                <form action={inviteFormAction}>
                  {inviteState.error && (
                    <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
                      {inviteState.error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isInvitePending}
                    className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {isInvitePending ? "Genererer…" : "Generer invitasjonslenke"}
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-700">
                    {inviteUrl}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    {copied ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? "Kopiert!" : "Kopier"}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
