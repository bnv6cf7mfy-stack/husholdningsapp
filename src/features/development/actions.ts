"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const suggestionStatusValues = ["new", "planned", "done"] as const;
const suggestionPriorityValues = ["low", "medium", "high"] as const;

const addSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(240),
  details: z.string().trim().max(4000).optional(),
  priority: z.enum(suggestionPriorityValues)
});

const updateSuggestionStatusSchema = z.object({
  suggestionId: z.string().uuid(),
  status: z.enum(suggestionStatusValues)
});

const archiveSuggestionSchema = z.object({
  suggestionId: z.string().uuid()
});

async function resolveDevelopmentContext() {
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

export async function addDevelopmentSuggestionAction(formData: FormData) {
  const parsed = addSuggestionSchema.safeParse({
    title: formData.get("title"),
    details: formData.get("details") || undefined,
    priority: formData.get("priority") || "medium"
  });

  if (!parsed.success) {
    revalidatePath("/development");
    return;
  }

  const context = await resolveDevelopmentContext();

  if (!context) {
    revalidatePath("/development");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase.from("development_suggestions").insert({
    household_id: context.householdId,
    title: parsed.data.title,
    details: parsed.data.details || null,
    priority: parsed.data.priority,
    status: "new",
    submitted_by: context.profileId
  });

  revalidatePath("/development");
}

export async function updateDevelopmentSuggestionStatusAction(formData: FormData) {
  const parsed = updateSuggestionStatusSchema.safeParse({
    suggestionId: formData.get("suggestionId"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    revalidatePath("/development");
    return;
  }

  const context = await resolveDevelopmentContext();

  if (!context) {
    revalidatePath("/development");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase
    .from("development_suggestions")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.suggestionId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/development");
}

export async function archiveDevelopmentSuggestionAction(formData: FormData) {
  const parsed = archiveSuggestionSchema.safeParse({
    suggestionId: formData.get("suggestionId")
  });

  if (!parsed.success) {
    revalidatePath("/development");
    return;
  }

  const context = await resolveDevelopmentContext();

  if (!context) {
    revalidatePath("/development");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase
    .from("development_suggestions")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.suggestionId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/development");
}
