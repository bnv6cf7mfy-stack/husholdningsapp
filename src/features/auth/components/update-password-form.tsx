"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/features/auth/actions";
import { updatePasswordAction } from "@/features/auth/actions";
import { AuthStatusMessage } from "@/features/auth/components/auth-status-message";

const initialState: FormState = {};

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nytt passord</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-base"
          autoComplete="new-password"
        />
      </label>

      <AuthStatusMessage error={state.error} success={state.success} />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Oppdaterer..." : "Oppdater passord"}
      </button>

      <Link href="/login" className="text-sm text-slate-600 underline">
        Tilbake til login
      </Link>
    </form>
  );
}
