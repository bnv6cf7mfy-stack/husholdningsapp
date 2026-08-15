# Publisering for Vilde-testing

Denne sjekklisten tar appen fra lokal utvikling til en testbar, publisert versjon.

## 1) Forberedelser

1. Sørg for at `main` inneholder commit `9cb1a02`.
2. Verifiser at Supabase prosjekt for test er valgt.
3. Finn riktig kontakt-epost til `YR_USER_AGENT`.

## 2) Kjør ny database-migrasjon

Ny migrasjon i denne leveransen:
- `supabase/migrations/202608150001_development_suggestions.sql`

Alternativ A (Supabase CLI):

```powershell
supabase db push
```

Alternativ B (Supabase SQL Editor):

1. Åpne SQL Editor i Supabase.
2. Lim inn innholdet fra `supabase/migrations/202608150001_development_suggestions.sql`.
3. Kjør skriptet.

## 3) Sett miljøvariabler i Vercel

Legg inn disse variablene i Vercel prosjektet (Production + Preview):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (sett til faktisk Vercel-URL)
- `YR_LATITUDE`
- `YR_LONGITUDE`
- `YR_LOCATION_LABEL`
- `YR_USER_AGENT` (må inneholde kontaktinfo)

Kilde: `.env.example`.

## 4) Deploy

Automatisk deploy (anbefalt):
1. Push til `main`.
2. Vent til Vercel bygger ferdig.

Manuell deploy (om nødvendig):

```powershell
npx vercel --prod
```

## 5) Opprett testbruker til Vilde

1. Gå til Supabase Auth -> Users.
2. Opprett bruker for Vilde.
3. Send innloggingsinfo via sikker kanal.
4. Be Vilde logge inn og gjennomføre onboarding.

## 6) Testplan for Vilde (MVP)

1. Kalender:
- Legg inn middag via oppskriftsvelger i dag-popup.
- Endre barnehage L/H.
- Verifiser smart-påminnelser.

2. Oppskrifter:
- Opprett ny oppskrift med lenke/tid/porsjoner.
- Bekreft at oppskrift kan velges i kalenderdag.

3. Barn:
- Legg til barn med fødselsdato.
- Arkiver barn.

4. Utvikling:
- Legg inn minst 3 forslag.
- Endre status mellom Ny -> Planlagt -> Ferdig.
- Arkiver ett forslag.

## 7) Kjent teknisk notat

TypeScript viser deprecation-varsel for `baseUrl` i `tsconfig.json` (ikke blokkering for deploy akkurat nå).
