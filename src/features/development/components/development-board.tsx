"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CircleDot, Flag, Hammer, Rocket } from "lucide-react";
import {
  addDevelopmentSuggestionAction,
  archiveDevelopmentSuggestionAction,
  updateDevelopmentSuggestionStatusAction
} from "@/features/development/actions";
import type { DevelopmentSuggestion, SuggestionStatus } from "@/features/development/queries";
import type { SuggestionArea } from "@/features/development/types";
import { suggestionAreaLabels } from "@/features/development/types";

type DevelopmentBoardProps = {
  initialSuggestions: DevelopmentSuggestion[];
  currentUserName: string;
};

const statusOrder: SuggestionStatus[] = ["new", "planned", "done"];

const areaOptions = Object.entries(suggestionAreaLabels) as [SuggestionArea, string][];

const statusLabels: Record<SuggestionStatus, string> = {
  new: "Ny",
  planned: "Planlagt",
  done: "Ferdig"
};

const priorityLabels = {
  low: "Lav",
  medium: "Medium",
  high: "Høy"
} as const;

const priorityStyles = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800"
} as const;

const statusIcons = {
  new: CircleDot,
  planned: Hammer,
  done: Rocket
} as const;

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function DevelopmentBoard({ initialSuggestions, currentUserName }: DevelopmentBoardProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<DevelopmentSuggestion[]>(initialSuggestions);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      items: suggestions.filter((item) => item.status === status)
    }));
  }, [suggestions]);

  const addSuggestion = (title: string, details: string, priority: "low" | "medium" | "high", area: string) => {
    const trimmed = title.trim();

    if (!trimmed) {
      return;
    }

    const optimistic: DevelopmentSuggestion = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: trimmed,
      details: details.trim() || null,
      priority,
      area: (area as SuggestionArea) || null,
      status: "new",
      createdAt: new Date().toISOString(),
      submittedByName: currentUserName
    };

    setSuggestions((current) => [optimistic, ...current]);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      formData.set("details", details.trim());
      formData.set("priority", priority);
      formData.set("area", area);

      await addDevelopmentSuggestionAction(formData);
      router.refresh();
    });
  };

  const updateStatus = (suggestionId: string, status: SuggestionStatus) => {
    setSuggestions((current) => current.map((item) => (item.id === suggestionId ? { ...item, status } : item)));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("suggestionId", suggestionId);
      formData.set("status", status);

      await updateDevelopmentSuggestionStatusAction(formData);
      router.refresh();
    });
  };

  const archiveSuggestion = (suggestionId: string) => {
    setSuggestions((current) => current.filter((item) => item.id !== suggestionId));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("suggestionId", suggestionId);

      await archiveDevelopmentSuggestionAction(formData);
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Legg inn utviklingsforslag</h2>
        <form
          className="mt-3 grid gap-2 md:grid-cols-[1.2fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const title = (form.elements.namedItem("title") as HTMLInputElement | null)?.value ?? "";
            const details = (form.elements.namedItem("details") as HTMLTextAreaElement | null)?.value ?? "";
            const priority = ((form.elements.namedItem("priority") as HTMLSelectElement | null)?.value ?? "medium") as
              | "low"
              | "medium"
              | "high";
            const area = (form.elements.namedItem("area") as HTMLSelectElement | null)?.value ?? "";

            addSuggestion(title, details, priority, area);
            form.reset();
          }}
        >
          <input
            name="title"
            required
            placeholder="Kort tittel, f.eks. Deling av ukeplan"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <select name="area" className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="">Område (valgfritt)</option>
            {areaOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="priority" defaultValue="medium" className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="low">Lav prioritet</option>
            <option value="medium">Medium prioritet</option>
            <option value="high">Høy prioritet</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
            disabled={pending}
          >
            Legg til
          </button>
          <textarea
            name="details"
            placeholder="Valgfri forklaring: hvorfor, ønsket flyt, hvem det hjelper..."
            rows={3}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
          />
        </form>
      </article>

      <section className="grid gap-3 xl:grid-cols-3">
        {grouped.map((group) => {
          const Icon = statusIcons[group.status];

          return (
            <article key={group.status} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                <Icon className="h-4 w-4 text-primary" />
                {statusLabels[group.status]} ({group.items.length})
              </h3>

              <div className="mt-3 space-y-2">
                {group.items.length === 0 ? (
                  <p className="text-sm text-slate-500">Ingen forslag i denne kolonnen.</p>
                ) : (
                  group.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityStyles[item.priority]}`}>
                          <Flag className="h-3 w-3" />
                          {priorityLabels[item.priority]}
                        </span>
                      </div>
                      {item.area ? (
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {suggestionAreaLabels[item.area]}
                        </span>
                      ) : null}

                      {item.details ? <p className="mt-1 text-sm text-slate-600">{item.details}</p> : null}

                      <p className="mt-2 text-[11px] text-slate-500">
                        Av {item.submittedByName} · {formatDate(item.createdAt)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {statusOrder.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateStatus(item.id, status)}
                            disabled={pending || item.status === status}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.status === status
                                ? "bg-primary text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {statusLabels[status]}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => archiveSuggestion(item.id)}
                          disabled={pending}
                          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 text-slate-700"
                          aria-label={`Arkiver ${item.title}`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
