import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { getCurrentMembership } from "@/features/household/queries";

const modules = [
  {
    href: "/shopping" as Route,
    title: "Handleliste",
    description: "Kategorier og varer for ukens innkjøp."
  },
  {
    href: "/calendar" as Route,
    title: "Kalender",
    description: "Avtaler, aktiviteter og familiens plan."
  },
  {
    href: "/recipes" as Route,
    title: "Oppskrifter",
    description: "Oppskrifter, ingredienser og planlagt bruk."
  },
  {
    href: "/finance" as Route,
    title: "Økonomi",
    description: "Plassholder for kommende økonomi-modul."
  },
  {
    href: "/children" as Route,
    title: "Barn",
    description: "Profiler, mål, notater, milepæler og sitater."
  }
];

export default async function DashboardPage() {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">I dag</p>
        <h1 className="mt-2 text-3xl font-bold">Hei, {membership.householdName}</h1>
        <p className="mt-3 text-base text-slate-700">
          Velg hva du vil utforske videre. Barnehage og middag planlegges nå direkte inne i kalender per dag.
        </p>
        <p className="mt-2 text-sm text-slate-600">Din rolle: {membership.role}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
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
      </section>
    </main>
  );
}
