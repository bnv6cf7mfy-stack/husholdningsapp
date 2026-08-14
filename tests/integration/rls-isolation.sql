-- This file documents the SQL-level RLS test scope.
-- Executable automation is implemented in:
-- tests/integration/rls-isolation.spec.ts

-- Expected cross-household deny behavior for Household A against Household B:
-- 1) children: cannot read rows
-- 2) child_measurements: cannot read rows
-- 3) child_quotes: cannot read rows
-- 4) child_notes: cannot read rows
-- 5) calendar_events: cannot read rows
-- 6) shopping_items: cannot read rows
-- 7) children: cannot update rows

-- Positive control:
-- Household B can read own rows.

-- Keep this file as SQL contract for the automated test implementation.
