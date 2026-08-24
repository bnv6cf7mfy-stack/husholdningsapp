# GitHub Copilot-oppdrag: Bygg Finance v1.0 i husholdningsapp

## 1. Rolle og mandat
Du er co-arkitekt og senior fullstack-utvikler i den eksisterende produksjonsapplikasjonen `husholdningsapp`. Implementer Finance v1.0 som et nytt bounded context i dagens modulære monolitt.

Arbeid direkte i eksisterende kodebase. Ikke opprett en separat app, et separat API-prosjekt eller microservices. Ikke bytt teknologistack. Bevar eksisterende produksjonsfunksjonalitet og følg etablerte mønstre i repositoryet.

Gjennomfør oppgaven stegvis uten å vente på ny bekreftelse. Dersom en ekstern beslutning, hemmelig nøkkel eller utilgjengelig tjeneste faktisk blokkerer et steg, dokumenter blokkeringen presist og fortsett med alt annet som kan ferdigstilles.

## 2. Prosjektkontekst som skal legges til grunn
Applikasjonen er live i produksjon på Vercel og skal kunne skaleres fra én familie til mange husholdninger med streng dataisolasjon.

### Teknologistack
- Next.js 16.3.1 med App Router
- React 19.2.8
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- `@supabase/ssr` og `@supabase/supabase-js`
- Zod for validering
- Vitest for unit- og integrasjonstester
- Playwright for ende-til-ende-tester
- Vercel for produksjon
- GitHub Actions for CI

### Arkitekturmønster
- Modular monolith
- Presentasjon: `src/app` og `src/components`
- Domenelogikk: `src/features/*`
- Applikasjonstjenester: `src/services`
- Infrastruktur: `src/lib`
- Delte typer: `src/types`
- Hjelpefunksjoner: `src/utils`
- Persistens: Supabase PostgreSQL
- SQL-migrasjoner: `supabase/migrations/`
- Dokumentasjon og ADR-er: `docs/`

Finance er planlagt, men ikke implementert. Bruk:
- `src/features/finance/` for Finance-spesifikk domenelogikk, typer, schemas, hooks og komponenter
- `src/app/(protected)/finance/` for beskyttede Finance-ruter
- `src/services/` for orkestrerende applikasjonstjenester som går på tvers av lag
- `src/lib/` bare for generell Supabase-/infrastrukturlogikk
- `supabase/migrations/` for alle databaseendringer

### Sikkerhetsmodell
- Alle private Finance-tabeller skal ha `household_id` direkte, også der verdien kan utledes via en forelder. Dette gjør tenantgrense, indeksering og RLS eksplisitt.
- All tilgang skal autoriseres gjennom medlemskap i eksisterende `household_members`.
- RLS skal gjelde for `SELECT`, `INSERT`, `UPDATE` og `DELETE`.
- Ikke stol på `household_id` fra klienten alene. Serverlaget må validere medlemskap og konsistens.
- Ingen finance-data skal kunne leses eller endres på tvers av husholdninger.
- Bruk eksisterende profil- og auth-modell. Ikke opprett en parallell brukeridentitet.
- Ikke eksponer `SUPABASE_SERVICE_ROLE_KEY` til klienten.

### Read-model-prinsipp
Følg eksisterende prinsipp om query/read models over normaliserte kildetabeller fremfor å duplisere sannhetsdata.

For Finance betyr dette:
- Kontantstrømdefinisjoner, versjoner, forekomster, makroforutsetninger og saldopunkter er kildedata.
- Dashboard, grafer, kritiske perioder og aggregerte likviditetstall er read models.
- En materialisert daglig prognose kan lagres som regenererbar cache knyttet til en beregningskjøring.
- Ikke la en aggregert prognosetabell bli eneste sannhetskilde.

## 3. Første arbeidssteg: repository-inspeksjon
Les minst:
- `ARCHITECTURE.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TASKS.md`
- `docs/ER_MODEL.md`
- `docs/PRIVACY.md`
- relevante filer i `docs/adr/*`, særlig multitenancy
- eksisterende implementasjoner i minst to nærliggende bounded contexts
- eksisterende Supabase-klienter, auth-guards, RLS-policyer, Zod-mønstre, server actions/API-mønstre og testoppsett
- eksisterende `/finance`-rute dersom den allerede er en placeholder

Presenter deretter en kort implementeringsplan med:
1. filer som skal opprettes eller endres
2. migrasjoner og RLS
3. domenemodell og tjenester
4. UI-ruter og komponenter
5. read models/prognosemotor
6. tester
7. dokumentasjon

Fortsett så direkte med implementeringen.

## 4. Produktmål for v1.0
Finance v1.0 skal gi husholdningen en forklarbar likviditetsprognose basert på:
- forventede innbetalinger og utbetalinger
- saldopunkter for likvide bankkontoer
- gjentakelsesregler og spesifikke datoer
- regulering med KPI, lønnsvekst, renter eller egen sats
- eier av kontantstrøm eller konto
- daglig utvikling i brukskonto, bufferkonto og samlet likviditet

Arkitekturen skal kunne utvides senere med automatiske makrodata, AI-baserte forklaringer, formue/gjeld og banktransaksjoner uten større omskriving.

## 5. Avgrensning v1.0
### Inkluder
- manuell registrering og redigering av inntekter og utgifter
- månedlige, kvartalsvise, årlige og spesifikke betalingsdatoer
- versjonerte endringer i gjentakende poster
- kontoer og manuelle saldopunkter
- manuell administrasjon/import av KPI-, lønns- og renteforutsetninger
- daglig prognosemotor med konfigurerbar horisont, standard 10 år
- månedlig, årlig og flerårig visualisering
- minimum nødvendig buffer og anbefalt buffer
- kritiske dager/måneder og regelbaserte tiltak
- estimert overskuddslikviditet per år

### Ikke inkluder
- bankintegrasjon
- automatisk bokføring
- generativ AI i produksjon
- personlig investeringsrådgivning
- full balanse- og formuesmodell
- microservices eller separat dataplattform
- planlagte eksterne API-kall i produksjon i denne versjonen

## 6. Domene og navngivning
Bruk engelsk i kode og database, norsk i brukergrensesnittet.

### Kjernebegreper
- `CashFlowSeries`: logisk identitet for en inntekt eller utgift over tid
- `CashFlowDefinition`: én versjon av regelverket for serien
- `CashFlowOccurrence`: én konkret datert forekomst
- `AdjustmentRule`: hvordan beløpet reguleres
- `AssumptionSeries`: versjonert serie for KPI, lønn, rente eller egendefinert faktor
- `FinancialAccount`: likvid konto
- `AccountBalanceSnapshot`: saldo på konto på bestemt dato
- `ForecastRun`: én reproduserbar beregningskjøring
- `DailyLiquidityForecast`: regenererbart daglig read model

Bruk eksisterende konvensjon for SQL-navn, TypeScript-navn og mapper. Dersom repositoryet har en etablert navnestandard som avviker fra forslagene, følg repositoryet og dokumenter mappingen.

## 7. Kontantstrøminput
Lag ett felles skjema for inntekt og utgift.

### Felter
- Type: `income` eller `expense`
- Kategori
- Underkategori, valgfri
- Navn
- Beskrivelse, valgfri
- Grunnbeløp
- Valuta, standard `NOK`
- Eier: husholdningsmedlem eller `Felles`
- Gyldig fra
- Gyldig til, valgfri
- Gjentakelsestype
- Reguleringsregel

Ikke opprett et nytt personregister. Eier skal peke på eksisterende medlem i `household_members`. `NULL` kan representere `Felles` dersom dette passer eksisterende datamodell.

### Gjentakelsestyper
- Én gang
- Månedlig med valgt dag i måneden
- Kvartalsvis med startmåned og dag
- Årlig med måned og dag
- Spesifikke datoer

For korte måneder skal dag 29, 30 eller 31 falle på siste kalenderdag dersom dagen ikke finnes. Vis denne regelen i UI.

For spesifikke datoer skal brukeren kunne angi:
- dato
- standardbeløp
- valgfri beløpsfaktor
- valgfritt spesifikt beløp som overstyrer standardbeløpet

### Reguleringsregler
- Ingen
- KPI
- Lønnsvekst
- Renteprognose
- Fast årlig prosent
- Egendefinert forutsetningsserie

Standardregler:
- KPI reguleres 1. januar
- lønn reguleres 1. august
- registreringsåret reguleres ikke med mindre brukeren uttrykkelig aktiverer det
- rente følger datoene i valgt renteserie

For rentebaserte poster må modellen skille mellom:
1. rente beregnet på en hovedstol, for eksempel `referanserente + margin`
2. prosentvis justering av et eksisterende periodisk beløp

Støtt valgfri margin, gulv og tak.

### Beløp og fortegn
- Lagre grunnbeløp som positiv absoluttverdi med PostgreSQL `numeric`, aldri binær floating point.
- Bruk typefeltet til å bestemme fortegn i beregningslaget.
- Inntekter blir positive og utgifter negative i prognosen.
- Standard valuta er NOK, men behold valutafelt for fremtidig utvidelse.
- Ikke implementer valutakursberegning i v1.0.

## 8. Redigering og historikk
Ved endring av gjentakende serie skal UI tilby:
- Endre bare denne forekomsten
- Endre denne og fremtidige forekomster
- Endre hele serien

Ved `denne og fremtidige`:
1. avslutt aktiv definisjon dagen før valgt virkningsdato
2. opprett ny definisjonsversjon på samme serie
3. koble ny versjon til forrige versjon
4. regenerer bare påvirket prognoseperiode
5. bevar historiske data og auditinformasjon

Ikke hard-slett poster som inngår i historikk. Bruk deaktivering eller versjonering i tråd med eksisterende repository-mønstre.

## 9. Kontoer og saldopunkter
Lag en enkel registreringsflyt:
1. kontotype: brukskonto, bufferkonto, sparekonto eller annen likvid konto
2. kontonavn
3. saldo
4. saldodato, standard dagens dato
5. eier eller `Felles`
6. om kontoen kan brukes til betalinger
7. trekkprioritet
8. valgfri minimumssaldo

Ikke be om eller lagre fullt kontonummer. Tillat kun alias eller maskert identifikator.

Nye saldopunkter skal legges til som historikk. De skal ikke overskrive tidligere snapshots. Prognosen bruker seneste gyldige snapshot på eller før prognosestart.

## 10. Prognosemotor
Implementer prognosemotoren som ren og testbar TypeScript-domenelogikk så langt det er praktisk. Hold beregningsreglene uavhengige av React og Supabase I/O. Orkestrering og persistens kan ligge i applikasjonstjenester.

Motoren skal:
1. hente aktive definisjonsversjoner for valgt husholdning og periode
2. generere forekomster idempotent innen valgt horisont
3. anvende riktig forutsetningsserie og virkningsdato
4. summere daglige innbetalinger og utbetalinger
5. finne inngående og utgående saldo per konto og samlet
6. bruke betalingsaktiv brukskonto først og bufferkontoer etter angitt trekkprioritet
7. respektere minimumssaldo som terskel/varsel
8. flagge dager og måneder med terskelbrudd
9. aggregere samme grunnlag til måned og år
10. beregne årlig overskuddslikviditet

### Viktig om «til evigheten»
Ikke generer forekomster uten ende. Bruk rullerende prognosehorisont, standard 10 år. Gjør horisonten konfigurerbar.

### Beregningsidentitet
En kjøring skal kunne reproduseres med:
- `household_id`
- periode
- motorversjon
- versjon av kontantstrømdefinisjoner
- versjon av forutsetningsserier
- relevante saldopunkter

Operasjoner for generering og regenerering skal være idempotente.

## 11. Buffer og overskuddslikviditet
Vis to størrelser:

### Minimum nødvendig buffer
Største likviditetsgap i valgt periode etter hensyn til tilgjengelig saldo på betalingskontoer og planlagte kontantstrømmer.

### Anbefalt buffer
Minimum nødvendig buffer pluss en konfigurerbar sikkerhetsmargin. I v1.0 kan standard være 10 prosent, men lag regelen konfigurerbar og isolert. Merk resultatet som modellberegning, ikke finansråd.

### Overskuddslikviditet
For hvert kalenderår:
- beregn prognostisert saldo ved årets slutt
- trekk fra valgt minimums-/anbefalt buffer
- vis aldri negativt beløp som «kan reinvesteres»
- vis som `estimert tilgjengelig overskuddslikviditet`
- merk at beløpet er scenarioavhengig og ikke et investeringsråd

## 12. Dashboard og read models
Dashboardet skal vise:
- samlet likviditet på saldodato/i dag
- laveste prognostiserte saldo og dato
- minimum nødvendig buffer
- anbefalt buffer
- antall kritiske måneder
- neste vesentlige inn- og utbetalinger
- estimert overskuddslikviditet per år

Kritisk måned betyr at minst én dag i måneden bryter valgt terskel. Drilldown skal vise datoer, berørte kontoer og underliggende kontantstrømmer.

Lag forklarbare, regelbaserte tips i v1.0. Eksempler:
- en stor betaling kommer før en forventet innbetaling
- flere store betalinger faller på samme dato
- buffer er lavere enn beregnet minimum
- årsbetaling kan undersøkes for månedlig betaling

Hvert tips skal vise hvilken regel og hvilke data som utløste det. Ikke kall en ekstern språkmodell i v1.0.

## 13. Prognosevisning
Lag én hovedvisualisering med tre visningsknapper:

### Måned
- ett valgt kalenderår og én valgt måned
- daglig netto kontantstrøm
- akkumulert total likviditet
- saldo på brukskonto og bufferkonto

### År
- månedlig netto kontantstrøm
- månedssluttsaldo
- bufferbruk

### Flere år
- årlig sluttlikviditet
- årlig overskuddslikviditet
- laveste saldo per år

Krav:
- tydelig nullinje
- negativt område markeres med både farge og et ekstra visuelt signal
- tooltip med dato/periode, inngående saldo, innbetaling, utbetaling, netto, utgående saldo og bufferbruk
- klikk/drilldown til underliggende forekomster
- filtre for medlem, konto, kategori og scenario der dette finnes
- responsivt og tilgjengelig design
- gjenbruk eksisterende UI-komponenter og Tailwind-tokens

Ikke innfør et nytt diagram-bibliotek før du har kontrollert om prosjektet allerede har ett. Hvis ikke, velg den minst inngripende løsningen og dokumenter beslutningen i ADR dersom det er en varig arkitekturbeslutning.

## 14. Foreslått databaseutforming
Tilpass SQL til eksisterende conventions. Alle private tabeller skal ha `household_id`, tidsstempler og RLS.

### `finance_categories`
- `id`
- `household_id`
- `name`
- `parent_id`, nullable
- `cash_flow_scope`: `income`, `expense`, `both`
- `sort_order`
- `is_active`
- auditfelt

### `finance_cash_flow_series`
- `id`
- `household_id`
- `name`
- auditfelt

### `finance_cash_flow_definitions`
- `id`
- `household_id`
- `series_id`
- `version_number`
- `cash_flow_type`
- `category_id`
- `name`
- `description`
- `base_amount`
- `currency`
- `owner_member_id`, nullable
- `valid_from`
- `valid_to`, nullable
- `recurrence_type`
- `day_of_month`, nullable
- `month_of_year`, nullable
- `quarter_start_month`, nullable
- `adjustment_rule_id`, nullable
- `supersedes_definition_id`, nullable
- `is_active`
- auditfelt

### `finance_cash_flow_specific_dates`
- `id`
- `household_id`
- `definition_id`
- `occurrence_date`
- `amount_multiplier`
- `amount_override`, nullable
- auditfelt
- unik constraint på definisjon og dato

### `finance_adjustment_rules`
- `id`
- `household_id`
- `adjustment_type`
- `assumption_series_id`, nullable
- `adjustment_month`
- `adjustment_day`
- `base_date`
- `margin_rate`, nullable
- `floor_rate`, nullable
- `cap_rate`, nullable
- `apply_in_base_year`
- `interest_calculation_mode`, nullable
- `principal_amount`, nullable
- auditfelt

### `finance_assumption_series`
- `id`
- `household_id`, nullable bare dersom serien er eksplisitt systemforvaltet og RLS-modellen støtter dette sikkert
- `series_type`
- `name`
- `provider`
- `source_url`, nullable
- `frequency`
- `unit`
- `version_label`
- `published_at`, nullable
- `retrieved_at`, nullable
- `is_default`
- `is_forecast`
- auditfelt

Vurder nøye om felles systemserier skal ligge i egen tabell eller samme tabell. Ikke innfør globalt lesbare rader uten eksplisitt policy og test. Dokumenter beslutningen.

### `finance_assumption_values`
- `id`
- tenantkobling i tråd med valgt modell
- `assumption_series_id`
- `period_start`
- `value`
- `value_status`: `actual`, `forecast`, `manual`
- `source_reference`, nullable
- auditfelt
- unik constraint på serie, periode og versjon

### `finance_accounts`
- `id`
- `household_id`
- `name`
- `account_type`
- `owner_member_id`, nullable
- `currency`
- `masked_identifier`, nullable
- `payment_enabled`
- `draw_priority`
- `minimum_balance`
- `is_active`
- auditfelt

### `finance_account_balance_snapshots`
- `id`
- `household_id`
- `account_id`
- `balance_date`
- `balance`
- `source`: `manual`, senere `bank_import`
- auditfelt

### `finance_cash_flow_occurrences`
- `id`
- `household_id`
- `definition_id`
- `occurrence_date`
- `base_amount`
- `adjusted_amount`
- `signed_amount`
- `assumption_series_id`, nullable
- `assumption_value`, nullable
- `is_manual_override`
- `generation_key`
- auditfelt
- unik idempotensnøkkel

### `finance_forecast_runs`
- `id`
- `household_id`
- `forecast_start`
- `forecast_end`
- `engine_version`
- `input_version_snapshot` som `jsonb` dersom dette passer repositoryets mønster
- `status`
- `started_at`
- `completed_at`, nullable
- `error_message`, nullable uten sensitive data

### `finance_daily_liquidity_forecasts`
- `id`
- `household_id`
- `forecast_run_id`
- `forecast_date`
- `account_id`, nullable for samlet nivå
- `opening_balance`
- `cash_inflow`
- `cash_outflow`
- `net_cash_flow`
- `closing_balance`
- `buffer_draw`
- `is_critical`
- indeks på husholdning, kjøring, dato og konto

### `finance_liquidity_alerts`
- `id`
- `household_id`
- `forecast_run_id`
- `alert_type`
- `severity`
- `start_date`
- `end_date`
- `minimum_balance`
- `explanation_payload` som `jsonb`
- `is_dismissed`
- auditfelt

Før migrasjonen ferdigstilles:
- vurder om genererte forekomster bør persisteres eller genereres on demand i første versjon
- vurder kostnad og datamengde for 10-årshorisont
- følg read-model-prinsippet
- dokumenter valgt løsning i en Finance-ADR

## 15. Supabase-migrasjoner og RLS
Opprett nummererte migrasjoner etter eksisterende navnekonvensjon. Migrasjonene skal kunne kjøres manuelt i Supabase SQL Editor og være trygge på nye miljøer.

For hver tabell:
- opprett primærnøkler, fremmednøkler, checks og relevante indekser
- sikre at refererte rader tilhører samme husholdning der dette kan håndheves
- aktiver RLS
- opprett policies for autoriserte husholdningsmedlemmer
- test tenant-isolasjon

Unngå rekursive RLS-policyer. Gjenbruk eksisterende sikker medlemskapsfunksjon dersom repositoryet har en. Hvis en ny helper-funksjon er nødvendig, bruk `security definer` bare med eksplisitt `search_path`, minst mulige rettigheter og dokumentasjon.

Ikke legg migrasjonene bare i `combined_setup.sql`. Oppdater eventuelle samlefiler bare dersom det er etablert praksis, men behold nummererte migrasjoner som sannhetskilde.

Etter implementering skal README/checklisten presisere at nye Finance-migrasjoner må kjøres i Supabase SQL Editor i relevante miljøer.

## 16. Server- og klientgrenser
- Bruk Server Components som standard for innledende datalasting.
- Bruk Client Components bare for interaktive skjemaer, filtre og grafer.
- Følg eksisterende mønster for mutations, enten server actions eller route handlers. Ikke etabler et parallelt mønster.
- Valider all mutation-input med Zod på serveren.
- Klientvalidering kan gjenbruke samme schemas, men erstatter ikke servervalidering.
- Returner forventede, typede feil uten å lekke database- eller auth-detaljer.
- Revalider relevante routes/read models etter vellykkede mutations i tråd med eksisterende Next.js-mønster.

## 17. Foreslått mappestruktur
Tilpass etter repository-inspeksjon, men foretrekk omtrent:

```text
src/features/finance/
  components/
  schemas/
  domain/
    recurrence.ts
    adjustments.ts
    forecast-engine.ts
    buffer-policy.ts
  queries/
  mutations/
  types.ts
  constants.ts
  index.ts

src/app/(protected)/finance/
  page.tsx
  cash-flows/
  accounts/
  forecast/
  assumptions/

src/services/
  finance-forecast-service.ts

tests/
  unit/finance/
  integration/finance/
  e2e/finance/
```

Ikke flytt eksisterende delte komponenter inn i Finance. Finance-spesifikke komponenter skal bli i domenet; bare virkelig generiske komponenter skal deles.

## 18. Makroforutsetninger i v1.0
Lag modell, administrasjonsside og importgrensesnitt, men ikke bygg ukentlig ekstern oppdatering ennå.

Støtt:
- KPI
- årslønnsvekst
- styringsrente/rentebane
- egendefinert serie

Hver serie og verdi skal kunne vise:
- leverandør/kilde
- kildeadresse
- publiseringsdato
- hentetidspunkt
- faktisk eller prognose
- versjon
- enhet og frekvens

Ikke hardkod prognosetall som permanente sannheter. Seeddata skal være tydelig merket som demo eller eksplisitt kildeversjon. Hvis fremtidig periode mangler, skal appen varsle. Den skal ikke stille videreføre en verdi uten en eksplisitt regel eller brukeraksept.

## 19. Tester
### Unit, Vitest
Test ren domenelogikk minst for:
1. månedlig dag 31 i februar og korte måneder
2. skuddår
3. kvartalsvis og årlig gjentakelse
4. spesifikke datoer med faktor og overstyring
5. ingen regulering i registreringsåret som standard
6. KPI-regulering 1. januar
7. lønnsregulering 1. august
8. rente med hovedstol + margin
9. korrekt fortegn for inntekt og utgift
10. versjonsskifte fra valgt dato
11. daglig saldoavstemming
12. trekkprioritet mellom brukskonto og buffer
13. bufferberegning
14. årlig overskuddslikviditet
15. deterministisk resultat med identisk input

### Integrasjon, Vitest + Supabase
Test minst:
- CRUD og versjonering
- alle RLS-operasjoner
- bruker i husholdning A kan ikke lese/endre Finance-data i husholdning B
- eiermedlem og kategori må tilhøre riktig husholdning
- idempotent regenerering
- endret input ugyldiggjør eller regenererer relevant read model

Hvis lokal integrasjonstest blokkeres av kjent `SUPABASE_SERVICE_ROLE_KEY`-/`fetch failed`-problem, skal testene fortsatt implementeres. Dokumenter nøyaktig kommando, forventet miljø og den observerte blokkeringen. Ikke marker testen som bestått uten at den er kjørt.

### E2E, Playwright
Test minst én komplett flyt:
1. logg inn
2. åpne Finance
3. registrer konto og saldopunkt
4. registrer inntekt og utgift
5. kjør/vis prognose
6. kontroller kritisk periode eller positiv saldo
7. rediger fra en fremtidig dato
8. kontroller oppdatert graf og historikk

## 20. CI, bygg og produksjonssikkerhet
Kjør og rapporter:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- relevante integrasjons- og e2e-tester når miljøet tillater det

Ikke anta at produksjonsmiljøet har nye variabler. Finance v1.0 skal ikke kreve nye secrets. Fremtidige eksterne datakilder og AI skal bruke validerte env-vars via eksisterende env-modul.

Ikke endre Vercel Framework Preset eller eksisterende push-/cron-konfigurasjon uten at Finance faktisk krever det. Finance v1.0 skal ikke påvirke eksisterende notifications, messages, calendar, meals eller child-data.

## 21. Dokumentasjon
Opprett eller oppdater:
- `docs/FINANCE_DOMAIN.md`
- `docs/ECONOMY_MODULE_DEVELOPMENT_PLAN.md`
- `docs/adr/00xx-finance-domain-and-forecast-read-model.md`
- `docs/ER_MODEL.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TASKS.md`
- README eller deploy-checkliste med Finance-migrasjoner

`docs/FINANCE_DOMAIN.md` skal beskrive:
- bounded context og ansvar
- tabeller og relasjoner
- RLS og tenant-isolasjon
- beregningsregler
- bufferregel
- versjonering
- read models
- kjente avgrensninger

Utviklingsplanen skal minst inneholde:

### v1.5
- ukentlig kontroll/henting av siste KPI-, lønns- og rentedata
- versjonering og godkjenning før nye forutsetninger påvirker basisscenario
- scenarioer: basis, forsiktig og optimistisk
- forbedret regelmotor
- valgfri AI-oppsummering bak feature flag

### v2.0
- AI-genererte forklaringer og likviditetsforbedringer basert på strukturerte beregninger
- formue, eiendeler, gjeld, lån og nettoformue
- simulering av sparing/nedbetaling

### senere
- banktilkobling via egnet regulert leverandør
- faktiske transaksjoner og saldoer
- kategorisering og splitt
- interne overføringer
- husholdningsregnskap
- prognose mot faktisk og avviksforklaring

## 22. Akseptansekriterier
Finance v1.0 er ferdig når:
- Finance er et isolert bounded context i den modulære monolitten
- alle Finance-tabeller har korrekt tenantmodell og testet RLS
- migrasjoner kan kjøres på et nytt Supabase-miljø
- bruker kan registrere kontoer og daterte saldopunkter
- bruker kan registrere både inntekter og utgifter i samme flyt
- alle påkrevde gjentakelsesformer fungerer
- varige endringer kan gjelde fra en valgt dato uten å ødelegge historikk
- prognosemotoren produserer avstembare daglige saldoer
- måned-, år- og flerårsvisning bruker samme beregningsgrunnlag
- negativ likviditet og bufferbruk vises tydelig
- minimumsbuffer, anbefalt buffer og overskuddslikviditet vises forklarbart
- RLS-test viser at husholdninger er isolert
- lint, typecheck, unit tests og build passerer
- eventuelle ikke-kjørte integrasjons-/e2e-tester er tydelig dokumentert, aldri uriktig rapportert som bestått
- dokumentasjon og utviklingsplan er oppdatert

## 23. Leveranser og sluttrapport
Når implementeringen er ferdig, gi en kort, presis sluttrapport med:
1. arkitekturvalg
2. filer opprettet/endret
3. migrasjonsrekkefølge
4. RLS-policyer
5. tester som faktisk er kjørt og resultat
6. tester som ikke kunne kjøres og hvorfor
7. manuelle steg i Supabase/Vercel
8. kjente avgrensninger
9. anbefalt neste oppgave

Start nå med repository-inspeksjonen. Ikke implementer generiske eksempelkomponenter uten å koble dem til den faktiske Supabase-modellen, RLS og eksisterende applikasjonsmønstre.
