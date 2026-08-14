import Link from "next/link";

type FeaturePlaceholderPageProps = {
  title: string;
  description: string;
  nextSteps: string[];
};

export function FeaturePlaceholderPage({ title, description, nextSteps }: FeaturePlaceholderPageProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Modul</p>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-base text-slate-700">{description}</p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Neste steg i denne modulen</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold"
          >
            Tilbake til dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
