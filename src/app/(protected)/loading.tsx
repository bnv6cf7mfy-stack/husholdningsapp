export default function ProtectedLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-200" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </section>
    </main>
  );
}
