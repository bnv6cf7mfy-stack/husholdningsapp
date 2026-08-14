import { redirect } from "next/navigation";
import { signOutAction } from "@/features/auth/actions";
import { getCurrentMembership } from "@/features/household/queries";

export default async function DashboardPage() {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">I dag</p>
        <h1 className="mt-2 text-3xl font-bold">Hei, {membership.householdName}</h1>
        <p className="mt-3 text-base text-slate-700">
          Dashboard er klart for neste fase: barnehage, middag, neste avtale og handleliste.
        </p>
        <p className="mt-2 text-sm text-slate-600">Din rolle: {membership.role}</p>

        <form action={signOutAction} className="mt-6">
          <button className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">
            Logg ut
          </button>
        </form>
      </section>
    </main>
  );
}
