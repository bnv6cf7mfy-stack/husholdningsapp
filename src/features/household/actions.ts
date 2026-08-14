"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type HouseholdFormState = {
  error?: string;
};

const householdSchema = z.object({
  householdName: z.string().trim().min(2, "Household-navn må være minst 2 tegn.").max(120)
});

const defaultShoppingCategories = [
  "Frukt og grønt",
  "Kjøtt, fisk og pålegg",
  "Melkeprodukter",
  "Andre dagligvarer"
];

const deriveDisplayName = (email?: string) => {
  if (!email) return "Bruker";
  const candidate = email.split("@")[0] ?? "Bruker";
  return candidate.slice(0, 120);
};

export async function createHouseholdAction(
  _: HouseholdFormState,
  formData: FormData
): Promise<HouseholdFormState> {
  const parsed = householdSchema.safeParse({
    householdName: formData.get("householdName")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profileId: string | null = null;

  const { data: existingProfile, error: profileFetchError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileFetchError) {
    return { error: "Kunne ikke hente brukerprofil." };
  }

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: createdProfile, error: profileInsertError } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: user.id,
        display_name: deriveDisplayName(user.email)
      })
      .select("id")
      .single();

    if (profileInsertError || !createdProfile) {
      return { error: "Kunne ikke opprette profil." };
    }

    profileId = createdProfile.id;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: membership } = await adminSupabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", profileId)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  const householdId = randomUUID();

  const { error: householdError } = await supabase.from("households").insert({
    id: householdId,
    name: parsed.data.householdName,
    created_by: profileId
  });

  if (householdError) {
    return { error: "Kunne ikke opprette household." };
  }

  const { error: memberError } = await adminSupabase.from("household_members").insert({
    household_id: householdId,
    user_id: profileId,
    role: "owner"
  });

  if (memberError) {
    return { error: "Kunne ikke legge deg til som owner i household." };
  }

  const categoryRows = defaultShoppingCategories.map((name, index) => ({
    household_id: householdId,
    name,
    sort_order: index + 1,
    active: true
  }));

  await adminSupabase.from("shopping_categories").insert(categoryRows);

  redirect("/dashboard");
}
