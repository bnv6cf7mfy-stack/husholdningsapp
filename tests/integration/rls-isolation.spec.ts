import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestContext = {
  admin: SupabaseClient;
  userAClient: SupabaseClient;
  userBClient: SupabaseClient;
  userAAuthId: string;
  userBAuthId: string;
  userAProfileId: string;
  userBProfileId: string;
  householdAId: string;
  householdBId: string;
  childBId: string;
};

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

const missingEnv = !env.url || !env.anonKey || !env.serviceRoleKey;

const describeIfConfigured = missingEnv ? describe.skip : describe;

describeIfConfigured("RLS household isolation", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    const admin = createClient(env.url!, env.serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const suffix = Date.now();
    const userAEmail = `rls-user-a-${suffix}@example.test`;
    const userBEmail = `rls-user-b-${suffix}@example.test`;
    const password = `Pass!${randomUUID()}`;

    const userAResult = await admin.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true
    });

    if (userAResult.error || !userAResult.data.user) {
      throw new Error(`Failed to create user A: ${userAResult.error?.message ?? "Unknown error"}`);
    }

    const userBResult = await admin.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true
    });

    if (userBResult.error || !userBResult.data.user) {
      throw new Error(`Failed to create user B: ${userBResult.error?.message ?? "Unknown error"}`);
    }

    const userAAuthId = userAResult.data.user.id;
    const userBAuthId = userBResult.data.user.id;

    const profileAResult = await admin
      .from("profiles")
      .insert({ auth_user_id: userAAuthId, display_name: "RLS User A" })
      .select("id")
      .single();

    if (profileAResult.error || !profileAResult.data) {
      throw new Error(`Failed to create profile A: ${profileAResult.error?.message ?? "Unknown error"}`);
    }

    const profileBResult = await admin
      .from("profiles")
      .insert({ auth_user_id: userBAuthId, display_name: "RLS User B" })
      .select("id")
      .single();

    if (profileBResult.error || !profileBResult.data) {
      throw new Error(`Failed to create profile B: ${profileBResult.error?.message ?? "Unknown error"}`);
    }

    const userAProfileId = profileAResult.data.id;
    const userBProfileId = profileBResult.data.id;

    const householdAResult = await admin
      .from("households")
      .insert({ name: "RLS Household A", created_by: userAProfileId })
      .select("id")
      .single();

    if (householdAResult.error || !householdAResult.data) {
      throw new Error(
        `Failed to create household A: ${householdAResult.error?.message ?? "Unknown error"}`
      );
    }

    const householdBResult = await admin
      .from("households")
      .insert({ name: "RLS Household B", created_by: userBProfileId })
      .select("id")
      .single();

    if (householdBResult.error || !householdBResult.data) {
      throw new Error(
        `Failed to create household B: ${householdBResult.error?.message ?? "Unknown error"}`
      );
    }

    const householdAId = householdAResult.data.id;
    const householdBId = householdBResult.data.id;

    const memberInsertResult = await admin.from("household_members").insert([
      { household_id: householdAId, user_id: userAProfileId, role: "owner" },
      { household_id: householdBId, user_id: userBProfileId, role: "owner" }
    ]);

    if (memberInsertResult.error) {
      throw new Error(`Failed to insert memberships: ${memberInsertResult.error.message}`);
    }

    const childBResult = await admin
      .from("children")
      .insert({
        household_id: householdBId,
        first_name: "Child B",
        created_by: userBProfileId,
        active: true
      })
      .select("id")
      .single();

    if (childBResult.error || !childBResult.data) {
      throw new Error(`Failed to create child B: ${childBResult.error?.message ?? "Unknown error"}`);
    }

    const childBId = childBResult.data.id;

    const seedResults = await Promise.all([
      admin.from("child_measurements").insert({
        household_id: householdBId,
        child_id: childBId,
        measurement_type: "weight",
        value: 18.2,
        unit: "kg",
        measured_at: "2026-08-14",
        created_by: userBProfileId
      }),
      admin.from("child_quotes").insert({
        household_id: householdBId,
        child_id: childBId,
        quote_text: "Test quote",
        quoted_at: "2026-08-14",
        created_by: userBProfileId
      }),
      admin.from("child_notes").insert({
        household_id: householdBId,
        child_id: childBId,
        title: "Test note",
        content: "Private child note",
        note_type: "general",
        created_by: userBProfileId
      }),
      admin.from("calendar_events").insert({
        household_id: householdBId,
        title: "Private family event",
        starts_at: "2026-08-14T10:00:00Z",
        ends_at: "2026-08-14T11:00:00Z",
        all_day: false,
        event_type: "family",
        created_by: userBProfileId
      }),
      admin.from("shopping_categories").insert({
        household_id: householdBId,
        name: "RLS Test Category",
        sort_order: 1,
        active: true
      })
    ]);

    for (const result of seedResults) {
      if (result.error) {
        throw new Error(`Failed seed insert: ${result.error.message}`);
      }
    }

    const shoppingCategory = await admin
      .from("shopping_categories")
      .select("id")
      .eq("household_id", householdBId)
      .eq("name", "RLS Test Category")
      .single();

    if (shoppingCategory.error || !shoppingCategory.data) {
      throw new Error(
        `Failed to fetch shopping category: ${shoppingCategory.error?.message ?? "Unknown error"}`
      );
    }

    const shoppingItemResult = await admin.from("shopping_items").insert({
      household_id: householdBId,
      name: "Private milk",
      category_id: shoppingCategory.data.id,
      created_by: userBProfileId,
      completed: false
    });

    if (shoppingItemResult.error) {
      throw new Error(`Failed to create shopping item: ${shoppingItemResult.error.message}`);
    }

    const userAClient = createClient(env.url!, env.anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const userBClient = createClient(env.url!, env.anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const signInA = await userAClient.auth.signInWithPassword({ email: userAEmail, password });
    if (signInA.error) {
      throw new Error(`Failed sign in user A: ${signInA.error.message}`);
    }

    const signInB = await userBClient.auth.signInWithPassword({ email: userBEmail, password });
    if (signInB.error) {
      throw new Error(`Failed sign in user B: ${signInB.error.message}`);
    }

    ctx = {
      admin,
      userAClient,
      userBClient,
      userAAuthId,
      userBAuthId,
      userAProfileId,
      userBProfileId,
      householdAId,
      householdBId,
      childBId
    };
  });

  afterAll(async () => {
    if (!ctx) {
      return;
    }

    await ctx.admin.auth.admin.deleteUser(ctx.userAAuthId);
    await ctx.admin.auth.admin.deleteUser(ctx.userBAuthId);
  });

  it("blocks user A from reading user B children", async () => {
    const result = await ctx.userAClient
      .from("children")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from reading user B measurements", async () => {
    const result = await ctx.userAClient
      .from("child_measurements")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from reading user B quotes", async () => {
    const result = await ctx.userAClient
      .from("child_quotes")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from reading user B notes", async () => {
    const result = await ctx.userAClient
      .from("child_notes")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from reading user B calendar events", async () => {
    const result = await ctx.userAClient
      .from("calendar_events")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from reading user B shopping list", async () => {
    const result = await ctx.userAClient
      .from("shopping_items")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from updating user B child", async () => {
    const result = await ctx.userAClient
      .from("children")
      .update({ first_name: "Hacked" })
      .eq("id", ctx.childBId)
      .select("id, first_name");

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("allows user B to read own child", async () => {
    const result = await ctx.userBClient
      .from("children")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect((result.data ?? []).length).toBeGreaterThan(0);
  });
});
