// Finance RLS isolation test. Follows the same gating and structure pattern as
// tests/integration/rls-isolation.spec.ts: skipped entirely unless
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are present.
//
// Run with: npm run test:integration
//
// Status as of this change: NOT executed in this environment. The existing
// harness fails in beforeAll on auth.admin.createUser with "fetch failed"
// (see /memories/repo/deployment-and-verification-notes.md), which also
// blocks this file. It must be run against a connected Supabase project
// before being relied on as a passing gate.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestContext = {
  admin: SupabaseClient;
  userAClient: SupabaseClient;
  userAAuthId: string;
  userBAuthId: string;
  profileAId: string;
  householdAId: string;
  householdBId: string;
  accountBId: string;
};

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

const missingEnv = !env.url || !env.anonKey || !env.serviceRoleKey;
const describeIfConfigured = missingEnv ? describe.skip : describe;

describeIfConfigured("Finance RLS household isolation", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    const admin = createClient(env.url!, env.serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const suffix = Date.now();
    const userAEmail = `finance-rls-a-${suffix}@example.test`;
    const userBEmail = `finance-rls-b-${suffix}@example.test`;
    const password = `Pass!${randomUUID()}`;

    const userA = await admin.auth.admin.createUser({ email: userAEmail, password, email_confirm: true });
    const userB = await admin.auth.admin.createUser({ email: userBEmail, password, email_confirm: true });

    if (userA.error || !userA.data.user || userB.error || !userB.data.user) {
      throw new Error("Failed to create Finance RLS test users");
    }

    const profileA = await admin
      .from("profiles")
      .insert({ auth_user_id: userA.data.user.id, display_name: "Finance RLS User A" })
      .select("id")
      .single();
    const profileB = await admin
      .from("profiles")
      .insert({ auth_user_id: userB.data.user.id, display_name: "Finance RLS User B" })
      .select("id")
      .single();

    if (profileA.error || !profileA.data || profileB.error || !profileB.data) {
      throw new Error("Failed to create Finance RLS test profiles");
    }

    const householdA = await admin
      .from("households")
      .insert({ name: "Finance RLS Household A", created_by: profileA.data.id })
      .select("id")
      .single();
    const householdB = await admin
      .from("households")
      .insert({ name: "Finance RLS Household B", created_by: profileB.data.id })
      .select("id")
      .single();

    if (householdA.error || !householdA.data || householdB.error || !householdB.data) {
      throw new Error("Failed to create Finance RLS test households");
    }

    const membership = await admin.from("household_members").insert([
      { household_id: householdA.data.id, user_id: profileA.data.id, role: "owner" },
      { household_id: householdB.data.id, user_id: profileB.data.id, role: "owner" }
    ]);

    if (membership.error) {
      throw new Error(`Failed to create Finance RLS memberships: ${membership.error.message}`);
    }

    const accountB = await admin
      .from("finance_accounts")
      .insert({
        household_id: householdB.data.id,
        name: "Household B checking",
        account_type: "checking",
        created_by: profileB.data.id
      })
      .select("id")
      .single();

    if (accountB.error || !accountB.data) {
      throw new Error("Failed to create Finance RLS test account");
    }

    await admin.from("finance_account_balance_snapshots").insert({
      household_id: householdB.data.id,
      account_id: accountB.data.id,
      balance_date: "2027-01-01",
      balance: 50000,
      created_by: profileB.data.id
    });

    const userAClient = createClient(env.url!, env.anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const signInA = await userAClient.auth.signInWithPassword({ email: userAEmail, password });
    if (signInA.error) {
      throw new Error(`Failed sign in Finance RLS user A: ${signInA.error.message}`);
    }

    ctx = {
      admin,
      userAClient,
      userAAuthId: userA.data.user.id,
      userBAuthId: userB.data.user.id,
      profileAId: profileA.data.id,
      householdAId: householdA.data.id,
      householdBId: householdB.data.id,
      accountBId: accountB.data.id
    };
  });

  afterAll(async () => {
    if (!ctx) return;
    await ctx.admin.auth.admin.deleteUser(ctx.userAAuthId);
    await ctx.admin.auth.admin.deleteUser(ctx.userBAuthId);
  });

  it("blocks user A from reading user B's finance accounts", async () => {
    const result = await ctx.userAClient.from("finance_accounts").select("id").eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from reading user B's balance snapshots", async () => {
    const result = await ctx.userAClient
      .from("finance_account_balance_snapshots")
      .select("id")
      .eq("household_id", ctx.householdBId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("blocks user A from inserting a finance account into user B's household", async () => {
    const result = await ctx.userAClient.from("finance_accounts").insert({
      household_id: ctx.householdBId,
      name: "Injected account",
      account_type: "checking",
      created_by: ctx.profileAId
    });

    expect(result.error).not.toBeNull();
  });

  it("allows user A to manage finance data within their own household", async () => {
    const result = await ctx.userAClient
      .from("finance_accounts")
      .insert({
        household_id: ctx.householdAId,
        name: "Household A checking",
        account_type: "checking",
        created_by: ctx.profileAId
      })
      .select("id")
      .single();

    expect(result.error).toBeNull();
    expect(result.data?.id).toBeTruthy();
  });
});
