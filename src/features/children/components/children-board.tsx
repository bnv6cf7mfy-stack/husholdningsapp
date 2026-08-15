"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cake, Trash2, UserRound } from "lucide-react";
import { addChildAction, archiveChildAction } from "@/features/children/actions";
import type { ChildProfile } from "@/features/children/queries";

type ChildrenBoardProps = {
  initialChildren: ChildProfile[];
  currentUserName: string;
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatBirthDate(value: string | null) {
  if (!value) {
    return "Ikke satt";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export function ChildrenBoard({ initialChildren, currentUserName }: ChildrenBoardProps) {
  const router = useRouter();
  const [children, setChildren] = useState<ChildProfile[]>(initialChildren);
  const [pending, startTransition] = useTransition();

  const addChild = (firstName: string, nickname: string, dateOfBirth: string) => {
    const trimmed = firstName.trim();

    if (!trimmed) {
      return;
    }

    const optimisticChild: ChildProfile = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      firstName: trimmed,
      nickname: nickname.trim() || null,
      dateOfBirth: dateOfBirth.trim() || null,
      createdAt: new Date().toISOString(),
      createdByName: currentUserName
    };

    setChildren((current) => [optimisticChild, ...current]);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("firstName", trimmed);
      formData.set("nickname", nickname.trim());
      formData.set("dateOfBirth", dateOfBirth.trim());

      await addChildAction(formData);
      router.refresh();
    });
  };

  const archiveChild = (childId: string) => {
    setChildren((current) => current.filter((child) => child.id !== childId));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("childId", childId);

      await archiveChildAction(formData);
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Legg til barn</h2>
        <form
          className="mt-3 grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const firstName = (form.elements.namedItem("firstName") as HTMLInputElement | null)?.value ?? "";
            const nickname = (form.elements.namedItem("nickname") as HTMLInputElement | null)?.value ?? "";
            const dateOfBirth = (form.elements.namedItem("dateOfBirth") as HTMLInputElement | null)?.value ?? "";

            addChild(firstName, nickname, dateOfBirth);
            form.reset();
          }}
        >
          <input
            name="firstName"
            required
            placeholder="Fornavn"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            name="nickname"
            placeholder="Kallenavn (valgfritt)"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            name="dateOfBirth"
            type="date"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
            disabled={pending}
          >
            Legg til
          </button>
        </form>
      </article>

      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Barn i husholdningen ({children.length})</h2>
        <div className="mt-3 space-y-2">
          {children.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen barn lagt til enda.</p>
          ) : (
            children.map((child) => (
              <div key={child.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {child.firstName}
                    {child.nickname ? ` (${child.nickname})` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Cake className="h-3.5 w-3.5" />
                      {formatBirthDate(child.dateOfBirth)}
                    </span>
                    <span> · Lagt til av {child.createdByName} ({formatCreatedAt(child.createdAt)})</span>
                  </p>
                </div>
                <button
                  aria-label={`Arkiver ${child.firstName}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
                  onClick={() => archiveChild(child.id)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
