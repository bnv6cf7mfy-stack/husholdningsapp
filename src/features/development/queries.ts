import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/features/household/queries";
import type { SuggestionArea, SuggestionPriority, SuggestionStatus, DevelopmentSuggestion } from "@/features/development/types";
export type { SuggestionArea, SuggestionPriority, SuggestionStatus, DevelopmentSuggestion } from "@/features/development/types";
export { suggestionAreaLabels } from "@/features/development/types";

export type DevelopmentData = {
  householdName: string;
  currentUserName: string;
  suggestions: DevelopmentSuggestion[];
};

export async function getDevelopmentData(): Promise<DevelopmentData | null> {
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

  const { data: suggestionRows } = await adminSupabase
    .from("development_suggestions")
    .select("id, title, details, priority, status, area, created_at, submitted_by")
    .eq("household_id", membership.householdId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const profileIds = Array.from(new Set((suggestionRows ?? []).map((row) => row.submitted_by).filter(Boolean)));
  const profileNameMap = new Map<string, string>();

  if (profileIds.length > 0) {
    const { data: profileRows } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", profileIds);

    (profileRows ?? []).forEach((profile) => {
      profileNameMap.set(profile.id, profile.display_name);
    });
  }

  return {
    householdName: membership.householdName,
    currentUserName,
    suggestions:
      suggestionRows?.map((row) => ({
        id: row.id,
        title: row.title,
        details: row.details,
        priority: row.priority,
        status: row.status,
        area: row.area ?? null,
        createdAt: row.created_at,
        submittedByName: profileNameMap.get(row.submitted_by) ?? "Ukjent"
      })) ?? []
  };
}
