import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";


type NavigationItem = {
  href: Route;
  label: string;
  enabled?: boolean;
  badge?: string;
};

const navigationItems = [
  { href: "/dashboard" as Route, label: "Dashboard" },
  { href: "/shopping" as Route, label: "Handleliste" },
  { href: "/messages" as Route, label: "Meldinger" },
  { href: "/calendar" as Route, label: "Kalender" },
  { href: "/recipes" as Route, label: "Oppskrifter" },
  { href: "/ballerud" as Route, label: "Ballerud" },
  { href: "/development" as Route, label: "Utvikling", enabled: false, badge: "Kommer snart" },
  { href: "/finance" as Route, label: "Økonomi" },
  { href: "/children" as Route, label: "Barn", enabled: false, badge: "Kommer snart" },
  { href: "/settings" as Route, label: "Innstillinger" }
] satisfies NavigationItem[];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 overflow-x-auto border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-w-max items-center gap-2 px-3 py-2 sm:max-w-6xl sm:px-6">
          <nav className="flex shrink-0 flex-nowrap items-center gap-2" aria-label="Hovedmeny">
            {navigationItems.map((item) => {
              const baseClasses =
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition";

              if (item.enabled === false) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    className={`${baseClasses} cursor-not-allowed bg-slate-100 text-slate-400`}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${baseClasses} text-slate-700 hover:bg-slate-100`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form action={signOutAction} className="shrink-0">
            <button className="inline-flex h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              Logg ut
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
