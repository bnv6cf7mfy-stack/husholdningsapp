export default function OnboardingLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Laster</p>
        <div className="mt-3 h-8 w-44 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-slate-200" />
      </section>
    </main>
  );
}
