export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Laster</p>
        <div className="mt-3 h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-4 h-4 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-11 w-28 animate-pulse rounded-xl bg-slate-200" />
      </section>
    </main>
  );
}
