"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Apple, Beef, Milk, Store, Undo2 } from "lucide-react";
import type { ComponentType } from "react";
import {
  addShoppingItemAction,
  completeShoppingItemAction,
  uncompleteShoppingItemAction
} from "@/features/shopping/actions";
import type { ShoppingCategory, ShoppingItem } from "@/features/shopping/queries";

const categoryIcons: Record<string, ComponentType<{ className?: string }>> = {
  "Frukt og grønt": Apple,
  "Kjøtt, fisk og pålegg": Beef,
  Melkeprodukter: Milk,
  "Andre dagligvarer": Store
};

const formatCreatedAt = (isoDate: string) => {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

type ShoppingBoardProps = {
  categories: ShoppingCategory[];
  initialItems: ShoppingItem[];
  currentUserName: string;
};

export function ShoppingBoard({ categories, initialItems, currentUserName }: ShoppingBoardProps) {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [pending, startTransition] = useTransition();

  const openItemsByCategory = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();

    categories.forEach((category) => {
      map.set(
        category.id,
        items.filter((item) => item.categoryId === category.id && !item.completed)
      );
    });

    return map;
  }, [categories, items]);

  const completedItems = useMemo(() => items.filter((item) => item.completed), [items]);

  const addItem = (categoryId: string, name: string) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticItem: ShoppingItem = {
      id: tempId,
      name: trimmed,
      categoryId,
      completed: false,
      createdByName: currentUserName,
      createdAt: new Date().toISOString()
    };

    setItems((previous) => [optimisticItem, ...previous]);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("categoryId", categoryId);
      formData.set("name", trimmed);

      await addShoppingItemAction(formData);
      router.refresh();
    });
  };

  const completeItem = (itemId: string) => {
    const nowIso = new Date().toISOString();

    setItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed: true,
              createdAt: nowIso
            }
          : item
      )
    );

    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);

      await completeShoppingItemAction(formData);
      router.refresh();
    });
  };

  const uncompleteItem = (itemId: string) => {
    setItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed: false
            }
          : item
      )
    );

    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);

      await uncompleteShoppingItemAction(formData);
      router.refresh();
    });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {categories.map((category) => {
        const CategoryIcon = categoryIcons[category.name] ?? Store;
        const categoryItems = openItemsByCategory.get(category.id) ?? [];

        return (
          <article key={category.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CategoryIcon className="h-5 w-5 text-primary" />
              <span>{category.name}</span>
            </h2>
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const input = form.elements.namedItem("name") as HTMLInputElement | null;

                if (!input) {
                  return;
                }

                const value = input.value;
                input.value = "";
                addItem(category.id, value);
              }}
            >
              <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-primary/30">
                <span aria-hidden="true" className="inline-block h-5 w-5 rounded-full border border-slate-400" />
                <input
                  name="name"
                  required
                  placeholder="Ny vare..."
                  className="h-full w-full border-0 bg-transparent p-0 text-sm outline-none"
                />
              </label>
            </form>
            <div className="mt-4 space-y-2">
              {categoryItems.length === 0 ? (
                <p className="text-sm text-slate-500">Ingen varer i denne kategorien.</p>
              ) : (
                categoryItems.map((item) => (
                  <div key={item.id} className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3">
                    <button
                      aria-label={`Marker ${item.name} som kjøpt`}
                      className="inline-block h-5 w-5 rounded-full border border-slate-400 transition hover:bg-emerald-50"
                      onClick={() => completeItem(item.id)}
                      disabled={pending}
                    >
                      <span className="sr-only">Kjøpt</span>
                    </button>
                    <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                    <p className="ml-auto truncate text-[11px] text-slate-500">
                      av {item.createdByName} · {formatCreatedAt(item.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
        );
      })}

      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 xl:col-span-2">
        <details>
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
            Vis kjøpte ({completedItems.length})
          </summary>
          <div className="mt-4 space-y-2">
            {completedItems.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen kjøpte varer.</p>
            ) : (
              completedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-600 line-through">{item.name}</p>
                    <p className="text-xs text-slate-500">Opprettet av {item.createdByName}</p>
                    <p className="text-[11px] text-slate-400">{formatCreatedAt(item.createdAt)}</p>
                  </div>
                  <button
                    aria-label={`Angre kjøpt for ${item.name}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100"
                    onClick={() => uncompleteItem(item.id)}
                    disabled={pending}
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </details>
      </article>
    </section>
  );
}
