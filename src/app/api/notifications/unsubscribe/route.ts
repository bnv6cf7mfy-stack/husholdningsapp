import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentProfileId } from "@/features/household/queries";

const payloadSchema = z.object({
  endpoint: z.string().url()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ugyldig endpoint." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Ikke innlogget." }, { status: 401 });
  }

  const adminSupabase = createAdminSupabaseClient();
  const profileId = await getCurrentProfileId(user.id);

  if (!profileId) {
    return NextResponse.json({ ok: false, error: "Profil ikke funnet." }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from("push_subscriptions")
    .update({ enabled: false, last_seen_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    return NextResponse.json({ ok: false, error: "Kunne ikke deaktivere push-subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}