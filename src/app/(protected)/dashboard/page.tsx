import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/features/household/queries";
import { getShoppingData } from "@/features/shopping/queries";
import { getTodayWidgetData } from "@/features/calendar/today-widget-queries";
import { TodayWidget } from "@/features/calendar/components/today-widget";

export default async function DashboardPage() {
  const [membership, shoppingData, todayData] = await Promise.all([
    getCurrentMembership(),
    getShoppingData(),
    getTodayWidgetData()
  ]);

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
      {todayData && <TodayWidget data={todayData} />}
    </main>
  );
}
