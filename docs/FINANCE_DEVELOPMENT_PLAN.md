# Utviklingsplan for Finance-domenet

## Kontekst
Finance bygges som et bounded context i den eksisterende modulære monolitten `husholdningsapp`, med Next.js App Router, TypeScript, Supabase PostgreSQL, RLS, Zod, Vitest og Playwright. All privat Finance-data skal isoleres per `household_id` og følge eksisterende medlemskapsmodell.

## v1.0: Likviditetsprognose
### Produktleveranser
- Felles input for inntekt og utgift
- Gjentakelser og spesifikke datoer
- Versjonerte endringer fra valgt gyldighetsdato
- Likvide kontoer og daterte saldopunkter
- Manuelle og versjonerte KPI-, lønns- og renteforutsetninger
- Daglig prognosemotor
- Månedlig, årlig og flerårig read model
- Kritiske perioder, bufferbehov og forklarbare regler
- Estimert overskuddslikviditet per år

### Arkitektur
- `src/features/finance` som bounded context
- beskyttede ruter under `src/app/(protected)/finance`
- ren TypeScript for sentrale beregningsregler
- Supabase-migrasjoner med RLS
- alle private tabeller har `household_id`
- read models regenereres fra normaliserte kildedata
- standard prognosehorisont er 10 år, ikke fysisk «til evigheten»

### Kvalitetsporter
- testet tenant-isolasjon
- lint, typecheck, unit tests og produksjonsbuild
- integrasjons- og E2E-tester implementert og kjørt når miljøet tillater det
- Finance-dokumentasjon og ADR

## v1.5: Automatisering og scenarioer
### Eksterne makrodata
Bygg planlagt, idempotent oppdateringsjobb som:
- kontrollerer siste tilgjengelige KPI-, lønns- og rentedata, for eksempel ukentlig
- validerer respons og periodedekning
- lagrer ny kildeversjon uten å overskrive historikk
- viser differanse mot aktiv forutsetning
- krever godkjenning før basisscenario endres
- logger feil uten sensitive data

Planlagt infrastruktur:
- Next.js route handler egnet for Vercel Cron eller eksisterende cron-mønster
- secret validert gjennom eksisterende env-modul
- Supabase serverklient på serversiden
- ingen service-role-nøkkel på klienten

### Scenarioer
- basis
- forsiktig
- optimistisk
- egendefinert

Scenario skal referere til egne forutsetningsversjoner uten å kopiere alle kildedata.

### Smartere tiltak
- simuler betaling på annen dato
- simuler månedlig i stedet for årlig betaling
- simuler endret buffer
- vis før/etter-effekt
- ranger etter beregnet likviditetseffekt

### AI i v1.5
Valgfri AI-oppsummering kan innføres bak feature flag dersom:
- regelmotor og beregningsmotor er sannhetskilde
- prompten bare mottar nødvendige, strukturerte data
- rå bankidentifikatorer utelates
- hvert råd kan spores til beregning eller regel
- kostnad, personvern og feilmodus er dokumentert

## v2.0: Formue og forklarende AI
### Formue og balanse
Utvid med:
- eiendeler
- verdsettelsespunkter
- gjeld og lånebetingelser
- planlagte renter og avdrag
- eierandel
- likvid og illikvid formue
- nettoformue over tid

Mulige tabeller:
- `finance_assets`
- `finance_asset_valuations`
- `finance_liabilities`
- `finance_loan_terms`
- `finance_debt_payment_schedules`
- `finance_net_worth_snapshots`

Nettoformue skal være et regenererbart read model, ikke eneste sannhetskilde.

### AI-genererte forklaringer
AI kan:
- forklare årsaker til kritiske perioder
- oppsummere scenarioforskjeller
- formulere tiltak fra regelmotoren
- lage forslag som brukeren aktivt kan simulere og godkjenne

AI skal ikke:
- endre input automatisk
- skjule beregningsgrunnlaget
- presentere usikre prognoser som fakta
- gi ubegrunnede personlige investeringsråd

## Senere fase: Bankdata og faktisk husholdningsregnskap
### Banktilkobling
- bruk egnet regulert leverandør
- samtykkeflyt og tokenfornyelse
- kontoer, saldoer og transaksjoner
- aldri lagre bankpassord
- separer rå bankdata fra normaliserte data
- idempotent import og deduplisering

### Regnskap
- faktisk inntekt og forbruk per kategori
- manuell og automatisk kategorisering
- transaksjonssplitt
- interne overføringer uten resultatvirkning
- avstemming mot banksaldo
- prognose mot faktisk

Mulige tabeller:
- `finance_bank_connections`
- `finance_external_accounts`
- `finance_raw_bank_transactions`
- `finance_transactions`
- `finance_transaction_splits`
- `finance_merchant_rules`
- `finance_categorization_feedback`
- `finance_reconciliations`

## Tverrgående krav
### Sikkerhet og personvern
- RLS per husholdning
- minst mulig datainnsamling
- kryptering og sikker secret-håndtering
- auditspor
- eksport og sletting
- ingen sensitive bankdetaljer i logger eller AI-kontekst

### Datakvalitet
- kilde, versjon, publiseringsdato og hentetid
- eksplisitt faktisk/prognose/manuell-status
- ingen stille utfylling av manglende perioder
- idempotente importer
- avvikslogg og validering

### Produktprinsipper
- samme beregningsgrunnlag i alle visninger
- forklarbare tall
- scenario før endring
- universell utforming
- norsk UI og engelske kodebegreper
- ingen finansrådgivning forkledd som sikker anbefaling

## Prioritert rekkefølge
1. Sikret og testet Finance v1.0
2. Eksterne, versjonerte forutsetninger
3. Scenarioer og simulerbare regler
4. Valgfri AI-oppsummering
5. Eiendeler, gjeld og nettoformue
6. Bankintegrasjon og faktisk regnskap
7. Prognose mot faktisk og avviksforklaring

## Beslutningsporter
Før hver større fase avklares:
- datakilde og bruksvilkår
- RLS- og personvernmodell
- behov for nye Vercel-secrets
- kostnad og driftsmodell
- om funksjonen er informasjon, simulering eller rådgivning
- migrering og bakoverkompatibilitet
- målbare akseptansekriterier
