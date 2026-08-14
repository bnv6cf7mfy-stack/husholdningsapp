"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/features/auth/actions";
import { signInAction } from "@/features/auth/actions";
import { AuthStatusMessage } from "@/features/auth/components/auth-status-message";

const initialState: FormState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">E-post</span>
        <input
          name="email"
          type="email"
          required
          className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-base"
          autoComplete="email"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Passord</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-base"
          autoComplete="current-password"
        />
      </label>

      <AuthStatusMessage error={state.error} success={state.success} />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Logger inn..." : "Logg inn"}
      </button>

      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        <Link href="/register" className="underline">
          Opprett konto
        </Link>
        <Link href="/reset-password" className="underline">
          Glemt passord
        </Link>
      </div>
    </form>
  );
}
