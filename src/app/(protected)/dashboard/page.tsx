import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { getCurrentMembership } from "@/features/household/queries";
import { getShoppingData } from "@/features/shopping/queries";

const quickActions = [
  {
    href: "/shopping" as Route,
    title: "Handleliste",
    description: "Legg til og kryss av varer raskt."
  },
  {
    href: "/calendar" as Route,
    title: "Kalender",
    description: "Planlegg dagen med familieaktiviteter."
  },
  {
    href: "/household" as Route,
    title: "Husholdning",
    description: "Inviter medlemmer og administrer roller."
  }
];

const upcomingModules = [
  {
    title: "Økonomi",
    description: "Kommer snart"
  },
  {
    href: "/development" as Route,
    title: "Utvikling",
    description: "Brukes til produktforslag og prioritering"
  },
  {
    href: "/children" as Route,
    title: "Barn",
    description: "Profiler og notater"
  }
];

export default async function DashboardPage() {
  const membership = await getCurrentMembership();
  const shoppingData = await getShoppingData();

  if (!membership) {
    redirect("/onboarding");
  }

  const openItems = shoppingData?.items.filter((item) => !item.completed).length ?? 0;
  const completedItems = shoppingData?.items.filter((item) => item.completed).length ?? 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Familiehub</p>
        <h1 className="mt-2 text-3xl font-bold">Hei, {membership.householdName}</h1>
        <p className="mt-3 text-base text-slate-700">
          Her er dagens status og raskeste vei inn i arbeidsflyten dere bruker mest.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Åpne varer</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{openItems}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Kjøpte varer</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{completedItems}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Din rolle</p>
            <p className="mt-1 text-lg font-bold capitalize text-slate-900">{membership.role}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            prefetch={false}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-slate-900">{module.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{module.description}</p>
            <p className="mt-4 text-sm font-semibold text-primary">Åpne modul</p>
          </Link>
        ))}

        {upcomingModules.map((module) => (
          <div key={module.title} className="rounded-2xl bg-slate-100 p-5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-600">{module.title}</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {module.description}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Vises i menyen, men er ikke prioritert for aktiv bruk akkurat nå.</p>
          </div>
        ))}
      </section>
    </main>
  );
}
