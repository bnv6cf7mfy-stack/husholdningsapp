# Decision

Implement the Finance bounded context (v1.0 liquidity forecast) as normalized source tables (cash flow definitions/occurrences, accounts, balance snapshots, assumption series) plus two regenerable read models: `finance_cash_flow_occurrences` and `finance_daily_liquidity_forecasts`, produced by an explicit, idempotent forecast run rather than computed ad hoc on every page load.

# Context

Finance needs a 10-year daily liquidity projection that must be explainable, auditable and reproducible, while the underlying cash flow rules, assumptions and account balances change over time (see `docs/FINANCE_DOMAIN_SPEC.md`). The rest of the repository already follows a read-model pattern (calendar, child timeline) over normalized source tables under strict `household_id` + RLS isolation (ADR 0003).

# Options considered

- Compute the forecast entirely on demand in the request/response cycle, with no persistence.
- Persist only the final daily aggregate, discarding intermediate occurrences.
- Persist both the generated occurrences (source-derived cache) and the daily forecast (read model) per forecast run, as chosen.

# Decision

- Keep `finance_cash_flow_definitions` (versioned), `finance_cash_flow_specific_dates`, `finance_accounts` and `finance_account_balance_snapshots` as the only true source of truth.
- Generate `finance_cash_flow_occurrences` as an idempotent, regenerable cache (unique per `definition_id` + `occurrence_date`), enabling drilldown and auditability without recomputation.
- Persist one `finance_forecast_runs` row per execution plus its `finance_daily_liquidity_forecasts` rows (per account and one household-aggregate row), so forecasts are reproducible and historical runs remain inspectable.
- Embed the adjustment rule fields directly in `finance_cash_flow_definitions` instead of a separate `finance_adjustment_rules` table (1:1 relationship in v1.0); defer a `finance_liquidity_alerts` table in favor of the `is_critical` flag already on the daily forecast (see `docs/FINANCE_DOMAIN.md` for the full deviation list).
- All Finance tables carry `household_id` directly and are protected by RLS via the existing `public.is_household_member()` helper, consistent with ADR 0003.

# Consequences

- Forecast runs are explicit (user-triggered) rather than implicit, which keeps a 10-year daily horizon affordable and makes each run's inputs auditable via `input_version_snapshot`/`engine_version`.
- Editing a recurring cash flow "from a date forward" is a version-and-supersede operation, not a mutation of history, preserving old occurrences and audit trail.
- Extra storage cost for 10 years × accounts of daily rows per run; acceptable for household-scale data volumes in v1.0. Future runs can prune old `finance_forecast_runs` if this becomes a concern.
- Two tables can be extracted later (`finance_adjustment_rules`, `finance_liquidity_alerts`) without breaking the current read/write contracts, if reuse or richer explanations are needed.
