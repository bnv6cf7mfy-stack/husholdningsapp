"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const addRecipeSchema = z.object({
  name: z.string().trim().min(1).max(240),
  category: z.string().trim().max(120).optional(),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  servings: z.string().trim().optional(),
  prepTimeMinutes: z.string().trim().optional(),
  cookTimeMinutes: z.string().trim().optional()
});

async function resolveRecipesContext() {
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

function toNullableInt(value?: string) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

export async function addRecipeAction(formData: FormData) {
  const parsed = addRecipeSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    sourceUrl: formData.get("sourceUrl"),
    servings: formData.get("servings"),
    prepTimeMinutes: formData.get("prepTimeMinutes"),
    cookTimeMinutes: formData.get("cookTimeMinutes")
  });

  if (!parsed.success) {
    revalidatePath("/recipes");
    return;
  }

  const context = await resolveRecipesContext();

  if (!context) {
    revalidatePath("/recipes");
    return;
  }

  const sourceUrl = parsed.data.sourceUrl && parsed.data.sourceUrl.length > 0 ? parsed.data.sourceUrl : null;
  const category = parsed.data.category && parsed.data.category.length > 0 ? parsed.data.category : null;

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase.from("recipes").insert({
    household_id: context.householdId,
    name: parsed.data.name,
    category,
    source_url: sourceUrl,
    source_type: sourceUrl ? "external" : "internal",
    servings: toNullableInt(parsed.data.servings),
    prep_time_minutes: toNullableInt(parsed.data.prepTimeMinutes),
    cook_time_minutes: toNullableInt(parsed.data.cookTimeMinutes),
    created_by: context.profileId
  });

  revalidatePath("/recipes");
}

export async function archiveRecipeAction(formData: FormData) {
  const recipeId = String(formData.get("recipeId") ?? "");

  if (!recipeId) {
    revalidatePath("/recipes");
    return;
  }

  const context = await resolveRecipesContext();

  if (!context) {
    revalidatePath("/recipes");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase
    .from("recipes")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", recipeId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/recipes");
}
