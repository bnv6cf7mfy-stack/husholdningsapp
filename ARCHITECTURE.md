# Architecture

## Decision

Løsningen bygges som en modular monolith med Next.js App Router og Supabase som auth+databaseplattform.

## Why

- Enkel drift i tidlig fase.
- Tydelige domenegrenser uten microservice-kompleksitet.
- Mulig å vokse funksjonelt over flere år.

## High-level layers

1. Presentation: `src/app`, `src/components`.
2. Domain: `src/features/*` (auth, household, children, shopping, calendar, childcare, meals, recipes, finance).
3. Application services: `src/services`.
4. Infrastructure: `src/lib` (Supabase-klient, validering, logging).
5. Persistence: Supabase PostgreSQL + migrations + RLS.

## Domain boundaries

- Auth: identitet, session, reset password.
- Household: household + medlemskap + roller.
- Children: barn, målinger, sitater, notater, milepæler.
- Shopping: kategorier + varer + historikk.
- Calendar: avtaler og kalenderpresentasjon.
- Childcare: levering/henting per dato.
- Meals: middag per dato, integrert i kalender-UI.
- Recipes: oppskrifter, ingredienser, ekstern kilde.
- Finance: fremtidig modul (ikke implementert i v1).

## Calendar composition model

Kalenderen blir en read model som kombinerer:

- `calendar_events`
- `childcare_assignments`
- `meal_plans`
- `child_quotes` (som memory-indikator)

Dette unngar duplisering ved at kun relevante domener lagrer egne sannhetskilder.

## Child timeline architecture

Child timeline implementeres som query/read model over:

- `child_measurements`
- `child_quotes`
- `child_notes`
- `child_milestones`
- barnerelevante kalenderknytninger

Ingen tvungen dobbel lagring av samme sitat i egen timeline-tabell i v1.

## Multi-tenant security

- Alle private tabeller har `household_id`.
- RLS-policy basert pa medlemskap i `household_members`.
- Profil brukes som applikasjonsidentitet; auth data beholdes i Supabase Auth.

## Deployment

- GitHub repository
- GitHub Actions CI
- Vercel for web
- Supabase for DB/Auth
