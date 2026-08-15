"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const addChildSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  nickname: z.string().trim().max(120).optional(),
  dateOfBirth: z.string().trim().optional()
});

async function resolveChildrenContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data: membership } = await adminSupabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", profile.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  return {
    householdId: membership.household_id,
    profileId: profile.id
  };
}

export async function addChildAction(formData: FormData) {
  const parsed = addChildSchema.safeParse({
    firstName: formData.get("firstName"),
    nickname: formData.get("nickname"),
    dateOfBirth: formData.get("dateOfBirth")
  });

  if (!parsed.success) {
    revalidatePath("/children");
    return;
  }

  const context = await resolveChildrenContext();

  if (!context) {
    revalidatePath("/children");
    return;
  }

  const dateOfBirth = parsed.data.dateOfBirth && parsed.data.dateOfBirth.length > 0 ? parsed.data.dateOfBirth : null;
  const nickname = parsed.data.nickname && parsed.data.nickname.length > 0 ? parsed.data.nickname : null;

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase.from("children").insert({
    household_id: context.householdId,
    first_name: parsed.data.firstName,
    nickname,
    date_of_birth: dateOfBirth,
    created_by: context.profileId
  });

  revalidatePath("/children");
}

export async function archiveChildAction(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");

  if (!childId) {
    revalidatePath("/children");
    return;
  }

  const context = await resolveChildrenContext();

  if (!context) {
    revalidatePath("/children");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase
    .from("children")
    .update({
      active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", childId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/children");
}
