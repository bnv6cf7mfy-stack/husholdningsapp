import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/features/household/queries";

export type ChildProfile = {
  id: string;
  firstName: string;
  nickname: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  createdByName: string;
};

export type ChildrenData = {
  householdName: string;
  currentUserName: string;
  children: ChildProfile[];
};

export async function getChildrenData(): Promise<ChildrenData | null> {
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let currentUserName = "deg";

  if (user?.id) {
    const { data: currentProfile } = await adminSupabase
      .from("profiles")
      .select("display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (currentProfile?.display_name) {
      currentUserName = currentProfile.display_name;
    }
  }

  const { data: children } = await adminSupabase
    .from("children")
    .select("id, first_name, nickname, date_of_birth, created_at, created_by")
    .eq("household_id", membership.householdId)
    .eq("active", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const creatorIds = Array.from(new Set((children ?? []).map((child) => child.created_by).filter(Boolean)));
  const creatorMap = new Map<string, string>();

  if (creatorIds.length > 0) {
    const { data: creators } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", creatorIds);

    (creators ?? []).forEach((creator) => {
      creatorMap.set(creator.id, creator.display_name);
    });
  }

  return {
    householdName: membership.householdName,
    currentUserName,
    children:
      children?.map((child) => ({
        id: child.id,
        firstName: child.first_name,
        nickname: child.nickname,
        dateOfBirth: child.date_of_birth,
        createdAt: child.created_at,
        createdByName: creatorMap.get(child.created_by) ?? "Ukjent"
      })) ?? []
  };
}
