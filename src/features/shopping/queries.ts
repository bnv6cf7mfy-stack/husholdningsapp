import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/features/household/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fixedCategories = [
  "Frukt og grønt",
  "Kjøtt, fisk og pålegg",
  "Melkeprodukter",
  "Andre dagligvarer"
] as const;

export type ShoppingCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  categoryId: string | null;
  completed: boolean;
  createdByName: string;
  createdAt: string;
};

export type ShoppingData = {
  householdName: string;
  currentUserName: string;
  categories: ShoppingCategory[];
  items: ShoppingItem[];
};

export async function getShoppingData(): Promise<ShoppingData | null> {
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

  const { data: categories } = await adminSupabase
    .from("shopping_categories")
    .select("id, name, sort_order")
    .eq("household_id", membership.householdId)
    .eq("active", true)
    .in("name", [...fixedCategories])
    .order("sort_order", { ascending: true });

  const { data: items } = await adminSupabase
    .from("shopping_items")
    .select("id, name, category_id, completed, created_at, created_by")
    .eq("household_id", membership.householdId)
    .is("archived_at", null)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: false });

  const creatorIds = Array.from(new Set((items ?? []).map((item) => item.created_by).filter(Boolean)));
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
    categories:
      categories?.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order
      })) ?? [],
    items:
      items?.map((item) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        completed: item.completed,
        createdByName: creatorMap.get(item.created_by) ?? "Ukjent",
        createdAt: item.created_at
      })) ?? []
  };
}
