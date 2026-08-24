# Project goal

Bygge en produksjonsklar familie-/husholdningsapp som skalerer fra egen familie til mange households med streng dataisolasjon.

# Current architecture

Modular monolith med domeneseparasjon i `src/features/*` og Supabase RLS som sikkerhetsgrense.

# Current stack

- Next.js 16.3.1
- React 19.2.8
- TypeScript
- Tailwind CSS
- Supabase
- Vitest + Playwright

# Domain model

Auth, Household, Children, Shopping, Calendar, Childcare, Meals, Recipes, Finance (v1.0 liquidity forecast implemented; see `docs/FINANCE_DOMAIN.md`).

# Database model

Initial schema opprettet med tabeller for profiles, households, members, children, measurements, quotes, notes, milestones, shopping, calendar, childcare, meals, recipes, ingredients, pantry og audit log.

# Completed

- Foundation folder structure
- Next.js baseline config
- PWA manifest baseline
- Initial migration with indexes and RLS policies
- Seed baseline
- CI baseline
- Core architecture/security/docs skeleton
- Auth pages: login/register/reset/update-password
- Auth callback route for session exchange
- Protected onboarding and dashboard routes
- Household creation action with profile bootstrap
- Default shopping categories seeded during onboarding
- Migration for first-owner household membership policy
- RLS integration test harness implemented (`tests/integration/rls-isolation.spec.ts`)

# In progress

- Validate auth/onboarding flow and run integration tests against connected Supabase project

# Next steps

1. Koble mot faktisk Supabase-prosjekt og kjør migrations.
2. Kjør `npm run test:integration` mot testmiljo og verifiser deny/allow-resultater.
3. Implementer inviteringsflyt for partner.
4. Legg til onboarding-steg for valgfri barneregistrering.

# Open decisions

- Om en bruker skal kunne være i flere households i UI i v1 eller skjules bak en senere feature flag.
- Om vi bruker Supabase Edge Functions for audit enrichment eller app-lag i v1.

# Known issues

- Ingen kjente issues på nåværende tidspunkt.
- For integrasjonstester kreves Supabase service role key i .env.local.

# How to run locally

1. Installer Node.js 22+.
2. `npm ci`
3. `npm run dev`

# How to test

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

# Current migrations

- `supabase/migrations/202608140001_initial_schema.sql`
- `supabase/migrations/202608140002_household_bootstrap_policy.sql`
- `supabase/migrations/202608150001_development_suggestions.sql`
- `supabase/migrations/202608150002_development_suggestions_area.sql`
- `supabase/migrations/202608150003_household_invitations.sql`
- `supabase/migrations/202608150004_notifications.sql`
- `supabase/migrations/202608150005_household_messages.sql`
- `supabase/migrations/202608240001_finance_domain.sql` (Finance v1.0 — must still be run manually in the Supabase SQL Editor on any environment that doesn't have it yet)

# Security status

- Household isolation designet med `household_id` + RLS i private tabeller.
- Barnedata eksplisitt beskyttet med ikke-offentlige policy-prinsipper.

# Last verified state

Alle kvalitetssjekker kjørt og bestått lokalt:
- eslint: 0 feil
- tsc --noEmit: 0 feil
- vitest unit: 1/1 bestått
- next build: exit 0, alle ruter kompilert

# Finance v1.0 (2026-08-24)

- Implemented as a new bounded context: `src/features/finance`, `src/services/finance-forecast-service.ts`, `src/app/(protected)/finance`.
- Migration `202608240001_finance_domain.sql` adds 11 tables (categories, accounts, balance snapshots, assumption series/values, cash flow series/definitions/specific dates/occurrences, forecast runs, daily liquidity forecasts) with RLS on every table.
- Unit tests for the pure domain logic (recurrence, adjustments, buffer policy, forecast engine) pass: 23/23. See `docs/FINANCE_DOMAIN.md` for calculation rules and documented scope deviations from `docs/FINANCE_DOMAIN_SPEC.md`.
- Integration RLS test (`tests/integration/finance-rls-isolation.spec.ts`) and E2E test (`tests/e2e/finance.spec.ts`) are written but NOT yet passing/executed end-to-end: the Finance migration has not been applied to the connected Supabase project yet, so `finance_accounts` etc. don't exist there. Run the migration in the Supabase SQL Editor, then `npm run test:integration` and `npm run test:e2e`.
- Nav entry for "Økonomi" enabled in `src/app/(protected)/layout.tsx` (was a disabled "Kommer snart" placeholder).

# Last updated

2026-08-24
