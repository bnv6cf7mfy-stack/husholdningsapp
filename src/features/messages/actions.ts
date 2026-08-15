"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";
import { sendWebPushNotification } from "@/lib/notifications/web-push";

const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000)
});

export type MessageFormState = {
  error?: string;
};

export async function sendMessageAction(
  _: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const parsed = messageSchema.safeParse({ content: formData.get("content") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig melding." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getCurrentMembership(user.id);

  if (!membership) {
    redirect("/onboarding");
  }

  const profileId = await getCurrentProfileId(user.id);

  if (!profileId) {
    return { error: "Profil ikke funnet." };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { error } = await adminSupabase.from("household_messages").insert({
    household_id: membership.householdId,
    author_id: profileId,
    content: parsed.data.content
  });

  if (error) {
    return { error: "Kunne ikke sende melding." };
  }

  // Fetch author display name
  const { data: authorProfile } = await adminSupabase
    .from("profiles")
    .select("display_name")
    .eq("id", profileId)
    .maybeSingle();

  const authorName = authorProfile?.display_name ?? "En i husholdningen";

  // Send immediate push to all other household members
  const { data: subscriptions } = await adminSupabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, profile_id")
    .eq("household_id", membership.householdId)
    .eq("enabled", true)
    .neq("profile_id", profileId);

  if (subscriptions && subscriptions.length > 0) {
    const preview =
      parsed.data.content.length > 80
        ? `${parsed.data.content.slice(0, 80)}…`
        : parsed.data.content;

    const staleEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendWebPushNotification({
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          title: `Ny melding fra ${authorName}`,
          body: preview,
          url: "/messages"
        });

        if (
          !result.ok &&
          result.reason === "send_failed" &&
          (result.statusCode === 404 || result.statusCode === 410)
        ) {
          staleEndpoints.push(sub.endpoint);
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await adminSupabase
        .from("push_subscriptions")
        .update({ enabled: false, last_seen_at: new Date().toISOString() })
        .in("endpoint", staleEndpoints);
    }
  }

  revalidatePath("/messages");
  return {};
}
