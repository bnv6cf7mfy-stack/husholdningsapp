import { redirect } from "next/navigation";
import { DevelopmentBoard } from "@/features/development/components/development-board";
import { getDevelopmentData } from "@/features/development/queries";

export default async function DevelopmentPage() {
  const data = await getDevelopmentData();

  if (!data) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Utvikling</p>
        <h1 className="mt-2 text-3xl font-bold">{data.householdName}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Her kan Vilde og familien legge inn forslag, og dere kan prioritere hva som bygges videre.
        </p>
      </section>

      <DevelopmentBoard initialSuggestions={data.suggestions} currentUserName={data.currentUserName} />
    </main>
  );
}
