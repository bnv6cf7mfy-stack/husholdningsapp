"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const addItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid()
});

async function resolveShoppingContext() {
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

export async function addShoppingItemAction(formData: FormData) {
  const parsed = addItemSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId")
  });

  if (!parsed.success) {
    revalidatePath("/shopping");
    return;
  }

  const context = await resolveShoppingContext();

  if (!context) {
    revalidatePath("/shopping");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { error } = await adminSupabase.from("shopping_items").insert({
    household_id: context.householdId,
    name: parsed.data.name,
    category_id: parsed.data.categoryId,
    created_by: context.profileId
  });

  if (!error) {
    await adminSupabase.from("notification_events").insert({
      household_id: context.householdId,
      actor_profile_id: context.profileId,
      event_type: "shopping_item_added",
      payload: {
        itemName: parsed.data.name,
        categoryId: parsed.data.categoryId
      }
    });
  }

  revalidatePath("/shopping");
}

export async function completeShoppingItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    revalidatePath("/shopping");
    return { ok: false };
  }

  const context = await resolveShoppingContext();

  if (!context) {
    revalidatePath("/shopping");
    return { ok: false };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { error } = await adminSupabase
    .from("shopping_items")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      completed_by: context.profileId
    })
    .eq("id", itemId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/shopping");

  return { ok: !error };
}

export async function uncompleteShoppingItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    revalidatePath("/shopping");
    return { ok: false };
  }

  const context = await resolveShoppingContext();

  if (!context) {
    revalidatePath("/shopping");
    return { ok: false };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { error } = await adminSupabase
    .from("shopping_items")
    .update({
      completed: false,
      completed_at: null,
      completed_by: null
    })
    .eq("id", itemId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/shopping");

  return { ok: !error };
}
