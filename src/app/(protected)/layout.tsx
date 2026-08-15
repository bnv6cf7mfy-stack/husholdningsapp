import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";
import { PushNotificationToggle } from "@/features/notifications/components/push-notification-toggle";

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
  { href: "/development" as Route, label: "Utvikling", enabled: false, badge: "Under utvikling" },
  { href: "/finance" as Route, label: "Økonomi", enabled: false, badge: "Kommer snart" },
  { href: "/children" as Route, label: "Barn", enabled: false, badge: "Under utvikling" },
  { href: "/household" as Route, label: "Husholdning" }
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
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {navigationItems.map((item) => {
              const baseClasses =
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition";

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
                  prefetch={false}
                  className={`${baseClasses} text-slate-700 hover:bg-slate-100`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <PushNotificationToggle />
            <form action={signOutAction}>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                Logg ut
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
