"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/features/household/queries";

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(120)
});

export type UpdateProfileState = {
  error?: string;
  success?: string;
};

export async function updateProfileAction(
  _: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const parsed = displayNameSchema.safeParse({ displayName: formData.get("displayName") });

  if (!parsed.success) {
    return { error: "Navn må være mellom 1 og 120 tegn." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileId = await getCurrentProfileId(user.id);

  if (!profileId) {
    return { error: "Profil ikke funnet." };
  }

  const adminSupabase = createAdminSupabaseClient();

  const { error } = await adminSupabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", profileId);

  if (error) {
    return { error: "Kunne ikke oppdatere navn." };
  }

  revalidatePath("/settings");
  return { success: "Navn oppdatert." };
}
