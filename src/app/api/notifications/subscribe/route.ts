import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";

const payloadSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1)
    })
  })
});

const deriveDisplayName = (email?: string) => {
  if (!email) return "Bruker";
  const candidate = email.split("@")[0] ?? "Bruker";
  return candidate.slice(0, 120);
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ugyldig subscription payload." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Ikke innlogget." }, { status: 401 });
  }

  const adminSupabase = createAdminSupabaseClient();

  let profileId = await getCurrentProfileId(user.id);

  if (!profileId) {
    const { data: createdProfile, error: profileInsertError } = await adminSupabase
      .from("profiles")
      .insert({
        auth_user_id: user.id,
        display_name: deriveDisplayName(user.email)
      })
      .select("id")
      .single();

    if (profileInsertError || !createdProfile) {
      return NextResponse.json({ ok: false, error: "Kunne ikke opprette profil." }, { status: 500 });
    }

    profileId = createdProfile.id;
  }

  const membership = await getCurrentMembership(user.id);

  const { subscription } = parsed.data;
  const userAgent = request.headers.get("user-agent");

  const { error } = await adminSupabase.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      household_id: membership?.householdId ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      enabled: true,
      last_seen_at: new Date().toISOString()
    },
    {
      onConflict: "endpoint"
    }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: "Kunne ikke lagre push-subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}