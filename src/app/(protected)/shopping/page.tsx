import { redirect } from "next/navigation";
import { getShoppingData } from "@/features/shopping/queries";
import { ShoppingBoard } from "@/features/shopping/components/shopping-board";

export default async function ShoppingPage() {
  const data = await getShoppingData();

  if (!data) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Handleliste</p>
        <h1 className="mt-2 text-3xl font-bold">{data.householdName}</h1>
        <p className="mt-3 text-sm text-slate-600">Skriv varenavn direkte i riktig kategori. Huk av når varen er kjøpt.</p>
      </section>

      <ShoppingBoard
        householdId={data.householdId}
        categories={data.categories}
        initialItems={data.items}
        currentUserName={data.currentUserName}
      />
    </main>
  );
}
