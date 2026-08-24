# Backlog

- [ ] Household partner invitation via secure token/email flow
- [ ] Child timeline aggregated endpoint
- [ ] Holiday provider implementation with caching
- [ ] Realtime shopping sync

# Ready

- [ ] Partner invitation flow
- [ ] Optional onboarding step: add child now

# In progress

- [ ] Validate auth/onboarding flow against real Supabase project
- [ ] Execute RLS integration tests against connected Supabase project

# Blocked

- [ ] Execute local lint/typecheck/tests (blocked by missing Node/npm in current environment)
- [ ] Finance RLS integration test + E2E flow (blocked until `supabase/migrations/202608240001_finance_domain.sql` is applied to the connected Supabase project)
- [ ] `npm run lint` (blocked: repo has `eslint@9` installed but a legacy `.eslintrc.json`; ESLint 9 requires flat `eslint.config.js` — pre-existing, unrelated to Finance)

# Done

- [x] Foundation architecture documents
- [x] Initial Supabase schema and RLS structure
- [x] Roadmap + status + tasks governance files
- [x] CI baseline
- [x] Auth UI and server actions (login/register/logout/reset/update password)
- [x] Protected routes for onboarding and dashboard
- [x] Household creation flow with owner membership bootstrap
- [x] RLS integration test harness for two households
- [x] Finance v1.0 domain, migration, forecast engine, dashboard UI and unit tests (2026-08-24)
