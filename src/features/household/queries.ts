import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type CurrentMembership = {
  householdId: string;
  role: "owner" | "adult" | "member";
  householdName: string;
};

async function resolveAuthUserId(authUserId?: string) {
  if (authUserId) {
    return authUserId;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function getCurrentProfileId(authUserId?: string) {
  const resolvedAuthUserId = await resolveAuthUserId(authUserId);

  if (!resolvedAuthUserId) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", resolvedAuthUserId)
    .maybeSingle();

  return profile?.id ?? null;
}

export async function getCurrentMembership(authUserId?: string): Promise<CurrentMembership | null> {
  const resolvedAuthUserId = await resolveAuthUserId(authUserId);

  if (!resolvedAuthUserId) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", resolvedAuthUserId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data } = await adminSupabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", profile.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const { data: household } = await adminSupabase
    .from("households")
    .select("name")
    .eq("id", data.household_id)
    .maybeSingle();

  return {
    householdId: data.household_id,
    role: data.role,
    householdName: household?.name ?? "Husholdning"
  };
}
