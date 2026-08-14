import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) {
      redirect("/onboarding");
    }

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", profile.id)
      .limit(1)
      .maybeSingle();

    redirect(membership ? "/dashboard" : "/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Husholdningsapp</p>
        <h1 className="mt-2 text-3xl font-bold">Et samlet familieverktøy for hverdagen</h1>
        <p className="mt-3 text-base text-slate-700">
          Logg inn eller opprett konto for å starte onboarding og opprette household.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
            Logg inn
          </Link>
          <Link href="/register" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
            Opprett konto
          </Link>
        </div>
      </section>
    </main>
  );
}
