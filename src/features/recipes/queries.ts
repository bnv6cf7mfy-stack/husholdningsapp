import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/features/household/queries";

export type RecipeSummary = {
  id: string;
  name: string;
  category: string | null;
  sourceType: "internal" | "external" | "hybrid";
  sourceUrl: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  createdAt: string;
  createdByName: string;
};

export type RecipesData = {
  householdName: string;
  currentUserName: string;
  recipes: RecipeSummary[];
};

export async function getRecipesData(): Promise<RecipesData | null> {
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let currentUserName = "deg";

  if (user?.id) {
    const { data: currentProfile } = await adminSupabase
      .from("profiles")
      .select("display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (currentProfile?.display_name) {
      currentUserName = currentProfile.display_name;
    }
  }

  const { data: recipes } = await adminSupabase
    .from("recipes")
    .select("id, name, category, source_type, source_url, servings, prep_time_minutes, cook_time_minutes, created_at, created_by")
    .eq("household_id", membership.householdId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const creatorIds = Array.from(new Set((recipes ?? []).map((recipe) => recipe.created_by).filter(Boolean)));
  const creatorMap = new Map<string, string>();

  if (creatorIds.length > 0) {
    const { data: creators } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", creatorIds);

    (creators ?? []).forEach((creator) => {
      creatorMap.set(creator.id, creator.display_name);
    });
  }

  return {
    householdName: membership.householdName,
    currentUserName,
    recipes:
      recipes?.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        sourceType: recipe.source_type,
        sourceUrl: recipe.source_url,
        servings: recipe.servings,
        prepTimeMinutes: recipe.prep_time_minutes,
        cookTimeMinutes: recipe.cook_time_minutes,
        createdAt: recipe.created_at,
        createdByName: creatorMap.get(recipe.created_by) ?? "Ukjent"
      })) ?? []
  };
}
