import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "./accept-invite-button";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;

  const adminSupabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: invite } = await adminSupabase
    .from("household_invitations")
    .select("id, household_id, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.used_at || invite.expires_at < now) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 text-center">
          <p className="text-2xl font-bold mb-2">Ugyldig lenke</p>
          <p className="text-slate-500 text-sm">
            {invite?.used_at
              ? "Denne invitasjonslenken er allerede brukt."
              : "Invitasjonslenken er ugyldig eller utløpt."}
          </p>
        </div>
      </main>
    );
  }

  const { data: household } = await adminSupabase
    .from("households")
    .select("name")
    .eq("id", invite.household_id)
    .maybeSingle();

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/join/${token}`);
  }

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect(`/onboarding?next=/join/${token}`);
  }

  const { data: existingMember } = await adminSupabase
    .from("household_members")
    .select("id")
    .eq("household_id", invite.household_id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existingMember) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary mb-2">Invitasjon</p>
        <h1 className="text-2xl font-bold mb-3">
          Bli med i {household?.name ?? "husholdningen"}
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Du er invitert til å bli med. Trykk nedenfor for å akseptere.
        </p>
        <AcceptInviteButton token={token} />
      </div>
    </main>
  );
}
