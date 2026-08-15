"use client";

import { useTransition } from "react";
import { acceptInviteAction } from "@/features/household/actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInviteAction(token);
      if (result?.error) {
        alert(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isPending}
      className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
    >
      {isPending ? "Kobler til…" : "Aksepter invitasjon"}
    </button>
  );
}
