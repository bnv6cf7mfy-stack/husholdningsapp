import { redirect } from "next/navigation";
import { getFinanceOverview } from "@/features/finance/queries";
import { FinanceDashboard } from "@/features/finance/components/finance-dashboard";

export default async function FinancePage() {
  const overview = await getFinanceOverview();

  if (!overview) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Økonomi</p>
        <h1 className="mt-2 text-3xl font-bold">{overview.householdName}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Registrer kontoer, inntekter og utgifter, og kjør en likviditetsprognose for husholdningen.
        </p>
      </section>

      <FinanceDashboard overview={overview} />
    </main>
  );
}
