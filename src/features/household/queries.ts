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

export type HouseholdMember = {
  id: string;
  displayName: string;
  role: "owner" | "adult" | "member";
  joinedAt: string;
};

export type HouseholdPageData = {
  householdId: string;
  householdName: string;
  currentRole: "owner" | "adult" | "member";
  members: HouseholdMember[];
};

export async function getHouseholdPageData(): Promise<HouseholdPageData | null> {
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: members } = await adminSupabase
    .from("household_members")
    .select("id, role, joined_at, user_id")
    .eq("household_id", membership.householdId)
    .order("joined_at", { ascending: true });

  if (!members) {
    return null;
  }

  const profileIds = members.map((m) => m.user_id);
  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return {
    householdId: membership.householdId,
    householdName: membership.householdName,
    currentRole: membership.role,
    members: members.map((m) => ({
      id: m.id,
      displayName: profileMap.get(m.user_id) ?? "Ukjent",
      role: m.role,
      joinedAt: m.joined_at
    }))
  };
}
