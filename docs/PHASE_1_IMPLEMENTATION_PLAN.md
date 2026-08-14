# Phase 1 Implementation Plan (Auth + Household)

## Goal

Enable secure onboarding: register/login -> profile -> create household -> add first member.

## Deliverables

1. Auth pages and flows
- Register
- Login
- Logout
- Password reset

2. Profile bootstrap
- Create `profiles` row on first login if missing.
- Sync display name edits.

3. Household onboarding
- Create household name
- Auto-create owner membership
- Optional invite partner entry point

4. Authorization checks
- Guard routes by authenticated session.
- Enforce household membership for domain routes.

5. Integration tests
- Household A cannot read Household B data.
- Membership role checks for owner/admin actions.

## Suggested work breakdown

1. Build `src/features/auth` service layer
2. Build `src/features/household` service layer
3. Add onboarding route group in `src/app/(onboarding)`
4. Add protected app shell in `src/app/(app)`
5. Add first RLS integration test harness

## Exit criteria

- User can complete onboarding flow end-to-end.
- Household owner sees own household context only.
- Cross-household reads fail under RLS.
- Lint, typecheck, unit tests, build pass.
