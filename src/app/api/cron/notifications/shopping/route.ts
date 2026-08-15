import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendWebPushNotification, type WebPushSubscription } from "@/lib/notifications/web-push";

const BATCH_WINDOW_MINUTES = 5;

type NotificationEventRow = {
  id: string;
  household_id: string;
  actor_profile_id: string;
  payload: { itemName?: string };
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  profile_id: string;
};

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");

  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ ok: false, error: "VAPID keys are not configured." }, { status: 500 });
  }

  const adminSupabase = createAdminSupabaseClient();
  const cutoffIso = new Date(Date.now() - BATCH_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: events, error: eventsError } = await adminSupabase
    .from("notification_events")
    .select("id, household_id, actor_profile_id, payload")
    .eq("event_type", "shopping_item_added")
    .is("processed_at", null)
    .lte("created_at", cutoffIso)
    .order("created_at", { ascending: true });

  if (eventsError) {
    return NextResponse.json({ ok: false, error: "Kunne ikke hente notification events." }, { status: 500 });
  }

  const queuedEvents = (events ?? []) as NotificationEventRow[];

  if (queuedEvents.length === 0) {
    return NextResponse.json({ ok: true, processedEvents: 0, notificationsSent: 0 });
  }

  const householdIds = Array.from(new Set(queuedEvents.map((event) => event.household_id)));
  const actorIds = Array.from(new Set(queuedEvents.map((event) => event.actor_profile_id)));

  const { data: actorProfiles } = await adminSupabase
    .from("profiles")
    .select("id, display_name")
    .in("id", actorIds);

  const actorMap = new Map((actorProfiles ?? []).map((profile) => [profile.id, profile.display_name]));

  const { data: subscriptions, error: subscriptionsError } = await adminSupabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, profile_id, household_id")
    .eq("enabled", true)
    .in("household_id", householdIds);

  if (subscriptionsError) {
    return NextResponse.json({ ok: false, error: "Kunne ikke hente push-subscriptions." }, { status: 500 });
  }

  const subscriptionsByHousehold = new Map<string, SubscriptionRow[]>();

  (subscriptions ?? []).forEach((subscription) => {
    if (!subscription.household_id) return;

    const list = subscriptionsByHousehold.get(subscription.household_id) ?? [];
    list.push(subscription as SubscriptionRow);
    subscriptionsByHousehold.set(subscription.household_id, list);
  });

  let notificationsSent = 0;
  const staleEndpoints = new Set<string>();

  for (const householdId of householdIds) {
    const householdEvents = queuedEvents.filter((event) => event.household_id === householdId);
    const householdSubscriptions = subscriptionsByHousehold.get(householdId) ?? [];

    for (const subscription of householdSubscriptions) {
      const relevantEvents = householdEvents.filter((event) => event.actor_profile_id !== subscription.profile_id);

      if (relevantEvents.length === 0) {
        continue;
      }

      const uniqueActors = Array.from(
        new Set(relevantEvents.map((event) => actorMap.get(event.actor_profile_id) ?? "En i husholdningen"))
      );

      const title = "Handleliste oppdatert";
      const body =
        relevantEvents.length === 1
          ? `${uniqueActors[0]} la til 1 vare i handlelisten.`
          : `${uniqueActors.join(", ")} la til ${relevantEvents.length} varer i handlelisten.`;

      const pushResult = await sendWebPushNotification({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        } satisfies WebPushSubscription,
        title,
        body,
        url: "/shopping"
      });

      if (pushResult.ok) {
        notificationsSent += 1;
        continue;
      }

      if (pushResult.reason === "send_failed" && (pushResult.statusCode === 404 || pushResult.statusCode === 410)) {
        staleEndpoints.add(subscription.endpoint);
      }
    }
  }

  if (staleEndpoints.size > 0) {
    await adminSupabase
      .from("push_subscriptions")
      .update({ enabled: false, last_seen_at: new Date().toISOString() })
      .in("endpoint", Array.from(staleEndpoints));
  }

  await adminSupabase
    .from("notification_events")
    .update({ processed_at: new Date().toISOString() })
    .in(
      "id",
      queuedEvents.map((event) => event.id)
    );

  return NextResponse.json({
    ok: true,
    processedEvents: queuedEvents.length,
    notificationsSent,
    staleSubscriptionsDisabled: staleEndpoints.size
  });
}