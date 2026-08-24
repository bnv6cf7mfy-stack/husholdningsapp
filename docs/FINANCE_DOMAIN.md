# Finance Domain (v1.0)

## Bounded context and responsibility

Finance is an isolated bounded context inside the existing modular monolith, responsible for a household's explainable liquidity forecast: manual income/expense registration, recurring rules, account balances, and a daily/monthly/yearly forecast read model. It does not do bank integration, bookkeeping, or investment advice in v1.0 (see `docs/FINANCE_FUTURE.md` and `docs/FINANCE_DEVELOPMENT_PLAN.md` for later phases).

Code layout:
- `src/features/finance/` — types, Zod schemas, queries, server actions, pure domain logic (`domain/`), UI components.
- `src/services/finance-forecast-service.ts` — orchestrates domain logic + Supabase I/O for a forecast run.
- `src/app/(protected)/finance/` — the protected route.
- `supabase/migrations/202608240001_finance_domain.sql` — schema + RLS.

## Deviations from the original spec (documented deliberately)

1. **No separate `finance_adjustment_rules` table.** The adjustment rule (type, assumption series, margin/floor/cap, base-year flag, interest mode/principal) is embedded directly in `finance_cash_flow_definitions`, because in v1.0 an adjustment rule is always 1:1 with a definition version. It can be extracted into its own table later without breaking the public shape, if rules need to be shared across definitions.
2. **No separate `finance_liquidity_alerts` table.** Critical days/months are derived on the fly from `finance_daily_liquidity_forecasts.is_critical` (a persisted read model) instead of a second alerts table. This avoids a second, easily-inconsistent read model in v1.0; can be added later for richer explanation payloads.
3. **Single finance dashboard page** (`/finance`) instead of separate `/finance/accounts`, `/finance/cash-flows`, `/finance/forecast` routes, to keep the v1.0 surface small. The data/service layer already separates these concerns, so splitting into routes later is additive.
4. **`fixed_annual_percent` reuses the `margin_rate` column** to store the fixed percentage, instead of adding a new column, since the two are mutually exclusive by `adjustment_type`.
5. Cross-table household consistency (e.g. `owner_member_id` and `category_id` must belong to the same household) is enforced in the server action layer (see `assertMemberBelongsToHousehold` / `assertCategoryBelongsToHousehold` in `src/features/finance/actions.ts`), not via database triggers — consistent with how existing domains (e.g. `shopping_items.category_id`) are validated in this repository.

## Tables and relationships

See `supabase/migrations/202608240001_finance_domain.sql` for the authoritative definition. Summary:

- `finance_categories` — household-scoped income/expense/both categories, optional parent for grouping.
- `finance_accounts` — likely liquid accounts (checking/buffer/savings/other), payment-enabled flag, draw priority, minimum balance, optional owner (`household_members.id`) or `NULL` for "Felles".
- `finance_account_balance_snapshots` — dated, append-only balance history per account (never overwritten).
- `finance_assumption_series` / `finance_assumption_values` — versioned CPI / wage growth / interest / custom series, with per-period values and status (`actual`/`forecast`/`manual`).
- `finance_cash_flow_series` / `finance_cash_flow_definitions` — a series is the stable logical identity; each definition is one versioned ruleset (amount, recurrence, adjustment rule, validity window). Editing "this and future occurrences" closes the active definition (`valid_to`) and inserts a new version linked via `supersedes_definition_id`.
- `finance_cash_flow_specific_dates` — per-date amount override/multiplier for `recurrence_type = 'specific_dates'`.
- `finance_cash_flow_occurrences` — regenerable cache of concrete dated, signed amounts, produced by the forecast service; idempotent via `unique(definition_id, occurrence_date)` and a `generation_key`.
- `finance_forecast_runs` / `finance_daily_liquidity_forecasts` — one row per forecast execution plus its daily read model (per account + one aggregate row with `account_id = null`).

## RLS and tenant isolation

Every table has `household_id` and RLS is enabled with a single `for all using/with check (public.is_household_member(household_id))` policy, reusing the existing `is_household_member()` helper — identical pattern to every other domain in this repository. Server actions additionally resolve the caller's household via `getCurrentMembership()` and only ever write with that household_id (defense in depth against a compromised or buggy client), matching the existing `shopping`/`household` server action pattern (admin/service-role client + explicit `household_id` filters).

## Calculation rules

- **Recurrence** (`domain/recurrence.ts`): `once`, `monthly`, `quarterly`, `annual`, `specific_dates`. Day-of-month is clamped to the last valid day of short months (e.g. day 31 → Feb 28/29).
- **Adjustment/regulation** (`domain/adjustments.ts`): `none`, `cpi`, `wage_growth`, `fixed_annual_percent`, `custom_assumption`, `interest_rate`. CPI defaults to 1 January, wage growth to 1 August; both are configurable via `adjustment_month`/`adjustment_day`. No regulation is applied in the registration year unless `apply_in_base_year` is set. Percentage-based rules compound once per anniversary year. Interest rules support `rate_on_principal` (principal × (rate + margin), clamped by floor/cap) and `percentage_of_amount`.
- **Forecast engine** (`domain/forecast-engine.ts`): pure, deterministic day-by-day simulation. Household-level cash flows are applied to the payment-enabled account with the lowest `draw_priority` ("primary account"); a shortfall below its minimum balance is drawn from the remaining payment-enabled accounts in ascending `draw_priority` order ("buffer waterfall"), never below their own minimum balance. Produces one row per account per day plus one household-aggregate row (`account_id = null`).
- **Buffer policy** (`domain/buffer-policy.ts`): minimum required buffer = largest negative liquidity gap across the horizon; recommended buffer = minimum + configurable safety margin (default 10 %); annual surplus liquidity = year-end balance − buffer reference, floored at 0. All of this is explicitly a model estimate, not financial advice (surfaced in the UI copy).

## Read models

`finance_cash_flow_occurrences` and `finance_daily_liquidity_forecasts` are regenerable caches derived from the source tables (definitions, specific dates, assumption values, accounts, balance snapshots) — never the sole source of truth. Re-running the forecast (`runFinanceForecastAction` → `runForecastForHousehold`) regenerates both for a fresh `forecast_run_id`; historical runs are kept for auditability.

## Known limitations (v1.0)

- Forecast horizon defaults to 10 years (`DEFAULT_FORECAST_HORIZON_YEARS`), not run on every mutation — the user triggers "Kjør prognose" explicitly.
- Assumption series lookups assume annual periods keyed by `YYYY-01-01`; monthly/quarterly assumption frequencies are modeled in the schema but not yet consumed by the engine.
- Regulering (adjustment) UI only exposes "Ingen" and "Fast årlig prosent" (which reuses `margin_rate`). CPI, wage growth and interest-rate regulation are fully implemented in the domain engine (`domain/adjustments.ts`) and schema, but are disabled in the UI until there is a way to create/manage `finance_assumption_series`/`finance_assumption_values` (planned v1.5 per `docs/FINANCE_DEVELOPMENT_PLAN.md`) — selecting them today would silently apply a 0% adjustment since no series exists to look values up from.
- No scenarios (basis/forsiktig/optimistisk), no external data ingestion, no AI summaries — all deferred to v1.5/v2.0 per `docs/FINANCE_DEVELOPMENT_PLAN.md`.
- The forecast chart (month/year/multi-year toggle) is a lightweight inline SVG line chart, not a full charting library — deliberately, to avoid introducing a new dependency for v1.0. It shows closing balance with a zero-line and highlights negative/critical points in red; drilldown to underlying occurrences is not yet implemented.
- Categories support one level of nesting (`parent_id`) via the "Kategorier" section on the dashboard; the category select shown in the cash flow form is flat ("Parent › Child") and does not yet filter by `cash_flow_scope` (income/expense/both) client-side — the constraint is enforced by the field's meaning only, not by hiding mismatched options.
- "Rediger" on an existing cash flow only changes the base amount from a chosen effective date forward (`reviseFinanceCashFlowAction`, "denne og fremtidige"); it does not yet support "kun denne forekomsten" or changing recurrence/category/owner on an existing series.
