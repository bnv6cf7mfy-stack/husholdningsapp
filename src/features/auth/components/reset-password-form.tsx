"use client";

import { useActionState } from "react";
import type { FormState } from "@/features/auth/actions";
import { resetPasswordAction } from "@/features/auth/actions";
import { AuthStatusMessage } from "@/features/auth/components/auth-status-message";

const initialState: FormState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

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

      <AuthStatusMessage error={state.error} success={state.success} />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sender..." : "Send reset-lenke"}
      </button>
    </form>
  );
}
