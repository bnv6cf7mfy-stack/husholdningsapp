import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/features/household/queries";
import { CreateHouseholdForm } from "@/features/household/components/create-household-form";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getCurrentMembership(user.id);

  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Onboarding</p>
        <h1 className="mt-2 text-2xl font-bold">Opprett ditt household</h1>
        <p className="mt-2 text-sm text-slate-600">Gi household et navn. Du blir automatisk owner.</p>
        <div className="mt-6">
          <CreateHouseholdForm />
        </div>
      </section>
    </main>
  );
}
