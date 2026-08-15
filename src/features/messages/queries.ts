import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type HouseholdMessage = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type MessagesData = {
  householdId: string;
  householdName: string;
  currentProfileId: string;
  currentUserName: string;
  messages: HouseholdMessage[];
};

export async function getMessagesData(): Promise<MessagesData | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const membership = await getCurrentMembership(user.id);

  if (!membership) {
    return null;
  }

  const profileId = await getCurrentProfileId(user.id);

  if (!profileId) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();

  const [messagesResult, currentProfileResult] = await Promise.all([
    adminSupabase
      .from("household_messages")
      .select("id, content, author_id, created_at")
      .eq("household_id", membership.householdId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    adminSupabase
      .from("profiles")
      .select("display_name")
      .eq("id", profileId)
      .maybeSingle()
  ]);

  const messages = messagesResult.data ?? [];
  const authorIds = Array.from(new Set(messages.map((m) => m.author_id)));

  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, display_name")
    .in("id", authorIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return {
    householdId: membership.householdId,
    householdName: membership.householdName,
    currentProfileId: profileId,
    currentUserName: currentProfileResult.data?.display_name ?? "Deg",
    messages: messages.map((m) => ({
      id: m.id,
      content: m.content,
      authorId: m.author_id,
      authorName: profileMap.get(m.author_id) ?? "Ukjent",
      createdAt: m.created_at
    }))
  };
}
