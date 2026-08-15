import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getHouseholdPageData } from "@/features/household/queries";
import { SettingsPanel } from "@/features/settings/components/settings-panel";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminSupabase = createAdminSupabaseClient();

  const [householdData, profileResult] = await Promise.all([
    getHouseholdPageData(),
    adminSupabase
      .from("profiles")
      .select("display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle()
  ]);

  const currentDisplayName = profileResult.data?.display_name ?? "";
  const currentEmail = user.email ?? "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Innstillinger</p>
        <h1 className="mt-2 text-3xl font-bold">
          {householdData?.householdName ?? "Min konto"}
        </h1>
      </section>

      <SettingsPanel
        householdData={householdData}
        currentDisplayName={currentDisplayName}
        currentEmail={currentEmail}
      />
    </main>
  );
}
