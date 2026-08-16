import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentMembership, type CurrentMembership } from "@/features/household/queries";
import { getTodayWidgetData } from "@/features/calendar/today-widget-queries";
import { TodayWidget } from "@/features/calendar/components/today-widget";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function DashboardPage() {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/onboarding");
  }

  const adminSupabase = createAdminSupabaseClient();

  const [openItemsResult, completedItemsResult] = await Promise.all([
    adminSupabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", membership.householdId)
      .is("archived_at", null)
      .eq("completed", false),
    adminSupabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", membership.householdId)
      .is("archived_at", null)
      .eq("completed", true)
  ]);

  const openItems = openItemsResult.count ?? 0;
  const completedItems = completedItemsResult.count ?? 0;

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
      <Suspense fallback={<TodayWidgetLoading />}> 
        <TodayWidgetSection membership={membership} />
      </Suspense>
    </main>
  );
}

async function TodayWidgetSection({ membership }: { membership: CurrentMembership }) {
  const todayData = await getTodayWidgetData(membership);

  if (!todayData) {
    return null;
  }

  return <TodayWidget data={todayData} />;
}

function TodayWidgetLoading() {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-56 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-100" />
    </section>
  );
}
