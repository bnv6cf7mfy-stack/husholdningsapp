"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Timer, Trash2, Users } from "lucide-react";
import { addRecipeAction, archiveRecipeAction } from "@/features/recipes/actions";
import type { RecipeSummary } from "@/features/recipes/queries";

type RecipesBoardProps = {
  initialRecipes: RecipeSummary[];
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

function formatDuration(prep: number | null, cook: number | null) {
  const total = (prep ?? 0) + (cook ?? 0);
  if (total <= 0) {
    return "Tid ikke satt";
  }
  return `${total} min`;
}

export function RecipesBoard({ initialRecipes, currentUserName }: RecipesBoardProps) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeSummary[]>(initialRecipes);
  const [pending, startTransition] = useTransition();

  const addRecipe = (form: HTMLFormElement) => {
    const name = (form.elements.namedItem("name") as HTMLInputElement | null)?.value?.trim() ?? "";
    const category = (form.elements.namedItem("category") as HTMLInputElement | null)?.value?.trim() ?? "";
    const sourceUrl = (form.elements.namedItem("sourceUrl") as HTMLInputElement | null)?.value?.trim() ?? "";
    const servings = (form.elements.namedItem("servings") as HTMLInputElement | null)?.value?.trim() ?? "";
    const prepTimeMinutes = (form.elements.namedItem("prepTimeMinutes") as HTMLInputElement | null)?.value?.trim() ?? "";
    const cookTimeMinutes = (form.elements.namedItem("cookTimeMinutes") as HTMLInputElement | null)?.value?.trim() ?? "";

    if (!name) {
      return;
    }

    const optimisticRecipe: RecipeSummary = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      category: category || null,
      sourceType: sourceUrl ? "external" : "internal",
      sourceUrl: sourceUrl || null,
      servings: servings ? Number(servings) : null,
      prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : null,
      cookTimeMinutes: cookTimeMinutes ? Number(cookTimeMinutes) : null,
      createdAt: new Date().toISOString(),
      createdByName: currentUserName
    };

    setRecipes((current) => [optimisticRecipe, ...current]);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("category", category);
      formData.set("sourceUrl", sourceUrl);
      formData.set("servings", servings);
      formData.set("prepTimeMinutes", prepTimeMinutes);
      formData.set("cookTimeMinutes", cookTimeMinutes);

      await addRecipeAction(formData);
      router.refresh();
    });
  };

  const archiveRecipe = (recipeId: string) => {
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("recipeId", recipeId);

      await archiveRecipeAction(formData);
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Ny oppskrift</h2>
        <form
          className="mt-3 grid gap-2 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            addRecipe(form);
            form.reset();
          }}
        >
          <input
            name="name"
            required
            placeholder="Navn på oppskrift"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            name="category"
            placeholder="Kategori (f.eks. Hverdag)"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            name="sourceUrl"
            type="url"
            placeholder="Lenke (valgfritt)"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              name="servings"
              type="number"
              min={1}
              placeholder="Porsjoner"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              name="prepTimeMinutes"
              type="number"
              min={1}
              placeholder="Prep min"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              name="cookTimeMinutes"
              type="number"
              min={1}
              placeholder="Kok min"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white md:col-span-2"
            disabled={pending}
          >
            Legg til oppskrift
          </button>
        </form>
      </article>

      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Oppskrifter ({recipes.length})</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {recipes.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen oppskrifter enda.</p>
          ) : (
            recipes.map((recipe) => (
              <div key={recipe.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{recipe.name}</p>
                    <p className="mt-1 text-xs text-slate-500">Lagt til av {recipe.createdByName} ({formatCreatedAt(recipe.createdAt)})</p>
                  </div>
                  <button
                    aria-label={`Arkiver ${recipe.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
                    onClick={() => archiveRecipe(recipe.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {recipe.category ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{recipe.category}</span>
                  ) : null}
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    {recipe.sourceType === "external" ? "Ekstern" : recipe.sourceType === "hybrid" ? "Hybrid" : "Intern"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {recipe.servings ? `${recipe.servings} porsjoner` : "Porsjoner ikke satt"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" />
                    {formatDuration(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                  </span>
                  {recipe.sourceUrl ? (
                    <a
                      href={recipe.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Åpne lenke
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
