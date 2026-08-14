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

Auth, Household, Children, Shopping, Calendar, Childcare, Meals, Recipes, Finance (future).

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

# Security status

- Household isolation designet med `household_id` + RLS i private tabeller.
- Barnedata eksplisitt beskyttet med ikke-offentlige policy-prinsipper.

# Last verified state

Alle kvalitetssjekker kjørt og bestått lokalt:
- eslint: 0 feil
- tsc --noEmit: 0 feil
- vitest unit: 1/1 bestått
- next build: exit 0, alle ruter kompilert

# Last updated

2026-08-14
