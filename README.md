# Husholdningsapp

Produksjonsorientert familie-/husholdningsapp bygget som en modern modular monolith med Next.js + Supabase.

## Teknologistack

- Next.js 16.3.1 (App Router)
- React 19.2.8
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + RLS)
- Vercel (deployment)
- Vitest + Playwright

## Mappestruktur

- `src/app` - Next.js routes og layout
- `src/features` - domenemoduler
- `src/lib` - delt infrastruktur
- `supabase/migrations` - schema + RLS
- `docs` - domene- og sikkerhetsdokumentasjon
- `tests` - unit, integration, e2e

## Kjerneprinsipp

- Household-isolasjon via `household_id` og RLS i alle private domener.
- Barn er eget domeneobjekt, ikke bare generiske household people.
- Kalender viser sammensatt read model (events + childcare + meals + quotes) uten tvungen duplisering.

## Kom i gang lokalt

1. Installer Node.js 22+.
2. Kopier `.env.example` til `.env.local`.
3. Installer avhengigheter: `npm ci`.
4. Start app: `npm run dev`.

## Kvalitetssikring

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`
- `npm run build`
- `npm run test:e2e`

## Integration test setup (RLS)

Opprett `.env.test.local` (eller bruk `.env.local`) med:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Integration-testen oppretter to testbrukere og to households, og verifiserer at
Household A ikke kan lese/endre data i Household B.

Se `PROJECT_STATUS.md` og `TASKS.md` for nåværende fremdrift.
