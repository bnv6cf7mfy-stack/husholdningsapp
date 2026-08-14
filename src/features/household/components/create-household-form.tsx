"use client";

import { useActionState } from "react";
import {
  createHouseholdAction,
  type HouseholdFormState
} from "@/features/household/actions";

const initialState: HouseholdFormState = {};

export function CreateHouseholdForm() {
  const [state, formAction, pending] = useActionState(createHouseholdAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Navn på household</span>
        <input
          name="householdName"
          type="text"
          required
          minLength={2}
          maxLength={120}
          placeholder="For eksempel Familien Berg"
          className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-base"
        />
      </label>

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Oppretter..." : "Opprett household"}
      </button>
    </form>
  );
}
