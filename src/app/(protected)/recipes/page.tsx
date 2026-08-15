import { redirect } from "next/navigation";
import { getRecipesData } from "@/features/recipes/queries";
import { RecipesBoard } from "@/features/recipes/components/recipes-board";

export default async function RecipesPage() {
  const data = await getRecipesData();

  if (!data) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Oppskrifter</p>
        <h1 className="mt-2 text-3xl font-bold">{data.householdName}</h1>
        <p className="mt-3 text-sm text-slate-600">
          MVP: lagre familiens basisoppskrifter med kategori, tid og lenke.
        </p>
      </section>

      <RecipesBoard initialRecipes={data.recipes} currentUserName={data.currentUserName} />
    </main>
  );
}
