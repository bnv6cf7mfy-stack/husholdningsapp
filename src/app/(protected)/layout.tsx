import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";

const navigationItems = [
  { href: "/dashboard" as Route, label: "Dashboard" },
  { href: "/shopping" as Route, label: "Handleliste" },
  { href: "/calendar" as Route, label: "Kalender" },
  { href: "/recipes" as Route, label: "Oppskrifter" },
  { href: "/development" as Route, label: "Utvikling" },
  { href: "/finance" as Route, label: "Økonomi" },
  { href: "/children" as Route, label: "Barn" }
];

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
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <form action={signOutAction}>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              Logg ut
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
