import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentMembership = {
  householdId: string;
  role: "owner" | "adult" | "member";
  householdName: string;
};

export async function getCurrentProfileId() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return profile?.id ?? null;
}

export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const supabase = await createServerSupabaseClient();
  const profileId = await getCurrentProfileId();

  if (!profileId) {
    return null;
  }

  const { data } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .eq("user_id", profileId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const householdName = (data.households as { name?: string } | null)?.name ?? "Husholdning";

  return {
    householdId: data.household_id,
    role: data.role,
    householdName
  };
}
