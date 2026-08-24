# Prosjektbrief for Copilot (co-arkitekt-kontekst)

> Lim inn/last opp denne filen i en ny Copilot-samtale for rask onboarding til prosjektet.

## Hva dette er

**husholdningsapp** — en produksjonsklar familie-/husholdningsapp (Next.js + Supabase) som skal skalere fra egen familie til mange households med streng dataisolasjon. Status: **live i produksjon** på Vercel.

## Arkitektur

- **Mønster:** Modular monolith, ikke microservices.
- **Presentation:** `src/app` (Next.js App Router) + `src/components`.
- **Domain:** `src/features/*` — hvert domene er isolert i egen mappe.
- **Application services:** `src/services`.
- **Infrastructure:** `src/lib` (Supabase-klient, validering, notifications, weather, env).
- **Persistence:** Supabase PostgreSQL, migrations i `supabase/migrations/`, sikkerhet via Row Level Security (RLS).

### Domener (`src/features/`)
`auth`, `household`, `children`, `childcare`, `calendar`, `meals`, `recipes`, `shopping`, `messages`, `notifications`, `development`, `finance` (fremtidig, ikke implementert), `navigation`, `settings`.

### Nøkkelprinsipp: multi-tenant sikkerhet
- Alle private tabeller har `household_id`.
- RLS-policyer basert på medlemskap i `household_members`.
- Barnedata er eksplisitt beskyttet (se `docs/CHILD_DATA_PRIVACY.md`).
- Profil = applikasjonsidentitet; selve auth-data ligger i Supabase Auth.

### Read-model-mønster (viktig for videre utvikling)
Kalender og barne-tidslinje bygges som **query/read models** over flere kildetabeller i stedet for å duplisere data:
- Kalender kombinerer: `calendar_events`, `childcare_assignments`, `meal_plans`, `child_quotes`.
- Barne-tidslinje kombinerer: `child_measurements`, `child_quotes`, `child_notes`, `child_milestones`.

## Teknologistack

- Next.js 16.3.1 (App Router), React 19.2.8, TypeScript, Tailwind CSS
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- Zod for validering
- web-push for push-varsler (VAPID)
- Vitest (unit + integration) + Playwright (e2e)
- Hosting: Vercel (prod) + GitHub Actions CI

## Mappestruktur (topp-nivå, forenklet)

```
src/
  app/                # routes (App Router)
    (auth)/            login, register, reset-password, update-password
    (protected)/       calendar, childcare, children, dashboard, development,
                        finance, household, meals, messages, onboarding, settings...
    api/               notifications, cron (push/shopping-batch)
  components/          delte UI-komponenter
  features/            domenelogikk per bounded context (se over)
  hooks/                delte React hooks
  lib/                  supabase-klient, env, notifications, weather
  services/             applikasjonstjenester
  types/                delte typer
  utils/                hjelpefunksjoner
supabase/
  migrations/           SQL-migrasjoner (kjøres manuelt i Supabase SQL Editor)
  seed.sql, combined_setup.sql
docs/                   ADR-er (docs/adr/*) + domenespesifikke docs
tests/
  unit/ integration/ e2e/
```

## Nyeste funksjoner (siste sesjon, 2026-08-15)

- Meldinger (`/messages`) med chat-UI + umiddelbar push-varsling.
- Push-notifikasjoner: service worker (`public/sw.js`), subscribe/unsubscribe API, 5-min cron-batch for handleliste.
- Samlet `/settings`-side (profil + husholdning + varsler), erstatter separat `/household`-nav.
- Dashboard: familiehub med status + "Viktig i dag"-widget (flyttet fra kalender).
- Vercel Framework Preset måtte settes eksplisitt til Next.js (var satt til "Other").

## Kjente åpne punkter

- Migrasjon 4 (`202608150004_notifications.sql`) og 5 (`202608150005_household_messages.sql`) må kjøres i Supabase SQL Editor på nye miljøer.
- VAPID-nøkler + `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` må settes som Vercel env-vars for at push/cron skal fungere.
- Integrasjonstester (`test:integration`) krever `SUPABASE_SERVICE_ROLE_KEY` i `.env.local`/`.env.test.local`; har feilet lokalt med `fetch failed` mot `auth.admin.createUser`.
- `/household`-ruten finnes fortsatt og bør redirecte til `/settings`.
- Finance-domenet er kun planlagt, ikke implementert.

## Kommandoer

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run test:integration` / `npm run test:e2e`
- `npm run vapid:generate` (genererer VAPID-nøkkelpar for push)

## Relevante docs å lese ved behov

- `ARCHITECTURE.md`, `PROJECT_STATUS.md`, `ROADMAP.md`, `TASKS.md`
- `docs/adr/*` (arkitekturbeslutninger, f.eks. 0003-household-multitenancy, 0006-meal-plan-domain, 0007-recipe-model, 0008-children-domain)
- `docs/CHILD_DATA_PRIVACY.md`, `docs/PRIVACY.md`, `docs/ER_MODEL.md`
