-- Finance domain (v1.0): liquidity forecast bounded context.
-- All private tables carry household_id directly and are protected by RLS via
-- the existing public.is_household_member() helper.

-- ----------
-- ENUM TYPES
-- ----------
create type public.finance_cash_flow_scope as enum ('income', 'expense', 'both');
create type public.finance_account_type as enum ('checking', 'buffer', 'savings', 'other');
create type public.finance_balance_source as enum ('manual', 'bank_import');
create type public.finance_assumption_series_type as enum ('cpi', 'wage_growth', 'interest_rate', 'custom');
create type public.finance_assumption_frequency as enum ('monthly', 'quarterly', 'annual');
create type public.finance_assumption_value_status as enum ('actual', 'forecast', 'manual');
create type public.finance_cash_flow_type as enum ('income', 'expense');
create type public.finance_recurrence_type as enum ('once', 'monthly', 'quarterly', 'annual', 'specific_dates');
create type public.finance_adjustment_type as enum (
  'none',
  'cpi',
  'wage_growth',
  'interest_rate',
  'fixed_annual_percent',
  'custom_assumption'
);
create type public.finance_interest_calculation_mode as enum ('rate_on_principal', 'percentage_of_amount');
create type public.finance_forecast_run_status as enum ('pending', 'completed', 'failed');

-- ----------
-- CATEGORIES
-- ----------
create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  parent_id uuid references public.finance_categories(id) on delete set null,
  cash_flow_scope public.finance_cash_flow_scope not null default 'both',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, name)
);

-- ----------
-- ACCOUNTS + BALANCE SNAPSHOTS
-- ----------
create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  account_type public.finance_account_type not null default 'checking',
  owner_member_id uuid references public.household_members(id) on delete set null,
  currency text not null default 'NOK' check (char_length(currency) = 3),
  masked_identifier text check (masked_identifier is null or char_length(masked_identifier) <= 40),
  payment_enabled boolean not null default true,
  draw_priority integer not null default 0,
  minimum_balance numeric(14, 2),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.finance_account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  balance_date date not null,
  balance numeric(14, 2) not null,
  source public.finance_balance_source not null default 'manual',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (account_id, balance_date)
);

-- ----------
-- ASSUMPTIONS (KPI / wage growth / interest rate / custom)
-- ----------
create table public.finance_assumption_series (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  series_type public.finance_assumption_series_type not null,
  name text not null check (char_length(name) between 1 and 160),
  provider text,
  source_url text,
  frequency public.finance_assumption_frequency not null default 'annual',
  unit text not null default 'percent',
  version_label text not null default 'v1',
  published_at date,
  retrieved_at timestamptz,
  is_default boolean not null default false,
  is_forecast boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.finance_assumption_values (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  assumption_series_id uuid not null references public.finance_assumption_series(id) on delete cascade,
  period_start date not null,
  value numeric(14, 6) not null,
  value_status public.finance_assumption_value_status not null default 'manual',
  source_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assumption_series_id, period_start)
);

-- ----------
-- CASH FLOW SERIES / DEFINITIONS (definitions embed the adjustment rule; see ADR)
-- ----------
create table public.finance_cash_flow_series (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.finance_cash_flow_definitions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  series_id uuid not null references public.finance_cash_flow_series(id) on delete cascade,
  version_number integer not null default 1,
  cash_flow_type public.finance_cash_flow_type not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  base_amount numeric(14, 2) not null check (base_amount >= 0),
  currency text not null default 'NOK' check (char_length(currency) = 3),
  owner_member_id uuid references public.household_members(id) on delete set null,
  valid_from date not null,
  valid_to date,
  recurrence_type public.finance_recurrence_type not null default 'monthly',
  day_of_month integer check (day_of_month is null or day_of_month between 1 and 31),
  month_of_year integer check (month_of_year is null or month_of_year between 1 and 12),
  quarter_start_month integer check (quarter_start_month is null or quarter_start_month between 1 and 3),
  adjustment_type public.finance_adjustment_type not null default 'none',
  assumption_series_id uuid references public.finance_assumption_series(id) on delete set null,
  adjustment_month integer check (adjustment_month is null or adjustment_month between 1 and 12),
  adjustment_day integer check (adjustment_day is null or adjustment_day between 1 and 31),
  margin_rate numeric(9, 6),
  floor_rate numeric(9, 6),
  cap_rate numeric(9, 6),
  apply_in_base_year boolean not null default false,
  interest_calculation_mode public.finance_interest_calculation_mode,
  principal_amount numeric(14, 2),
  supersedes_definition_id uuid references public.finance_cash_flow_definitions(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_to is null or valid_to >= valid_from),
  unique (series_id, version_number)
);

create table public.finance_cash_flow_specific_dates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  definition_id uuid not null references public.finance_cash_flow_definitions(id) on delete cascade,
  occurrence_date date not null,
  amount_multiplier numeric(9, 4) not null default 1,
  amount_override numeric(14, 2),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (definition_id, occurrence_date)
);

-- Generated occurrences: regenerable cache derived from definitions, kept for
-- auditability and idempotent forecast runs (see docs/FINANCE_DOMAIN.md).
create table public.finance_cash_flow_occurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  definition_id uuid not null references public.finance_cash_flow_definitions(id) on delete cascade,
  occurrence_date date not null,
  base_amount numeric(14, 2) not null,
  adjusted_amount numeric(14, 2) not null,
  signed_amount numeric(14, 2) not null,
  assumption_series_id uuid references public.finance_assumption_series(id) on delete set null,
  assumption_value numeric(14, 6),
  is_manual_override boolean not null default false,
  generation_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (definition_id, occurrence_date)
);

-- ----------
-- FORECAST RUNS + DAILY LIQUIDITY READ MODEL
-- ----------
create table public.finance_forecast_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  forecast_start date not null,
  forecast_end date not null,
  engine_version text not null,
  input_version_snapshot jsonb,
  status public.finance_forecast_run_status not null default 'pending',
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  error_message text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  check (forecast_end >= forecast_start)
);

create table public.finance_daily_liquidity_forecasts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  forecast_run_id uuid not null references public.finance_forecast_runs(id) on delete cascade,
  forecast_date date not null,
  account_id uuid references public.finance_accounts(id) on delete cascade,
  opening_balance numeric(14, 2) not null,
  cash_inflow numeric(14, 2) not null default 0,
  cash_outflow numeric(14, 2) not null default 0,
  net_cash_flow numeric(14, 2) not null default 0,
  closing_balance numeric(14, 2) not null,
  buffer_draw numeric(14, 2) not null default 0,
  is_critical boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- ----------
-- INDEXES
-- ----------
create index idx_finance_categories_household on public.finance_categories(household_id, is_active);
create index idx_finance_accounts_household on public.finance_accounts(household_id, is_active);
create index idx_finance_balance_snapshots_account_date on public.finance_account_balance_snapshots(account_id, balance_date desc);
create index idx_finance_assumption_values_series_period on public.finance_assumption_values(assumption_series_id, period_start);
create index idx_finance_cash_flow_definitions_series on public.finance_cash_flow_definitions(series_id, version_number desc);
create index idx_finance_cash_flow_definitions_household_active on public.finance_cash_flow_definitions(household_id, is_active, valid_from);
create index idx_finance_cash_flow_specific_dates_definition on public.finance_cash_flow_specific_dates(definition_id, occurrence_date);
create index idx_finance_cash_flow_occurrences_household_date on public.finance_cash_flow_occurrences(household_id, occurrence_date);
create index idx_finance_forecast_runs_household_created on public.finance_forecast_runs(household_id, created_at desc);
create index idx_finance_daily_forecasts_run_date on public.finance_daily_liquidity_forecasts(forecast_run_id, forecast_date, account_id);
create index idx_finance_daily_forecasts_household_date on public.finance_daily_liquidity_forecasts(household_id, forecast_date);

-- ----------
-- UPDATED_AT TRIGGERS
-- ----------
create trigger set_finance_categories_updated_at before update on public.finance_categories
for each row execute procedure public.set_updated_at();
create trigger set_finance_accounts_updated_at before update on public.finance_accounts
for each row execute procedure public.set_updated_at();
create trigger set_finance_account_balance_snapshots_updated_at before update on public.finance_account_balance_snapshots
for each row execute procedure public.set_updated_at();
create trigger set_finance_assumption_series_updated_at before update on public.finance_assumption_series
for each row execute procedure public.set_updated_at();
create trigger set_finance_assumption_values_updated_at before update on public.finance_assumption_values
for each row execute procedure public.set_updated_at();
create trigger set_finance_cash_flow_series_updated_at before update on public.finance_cash_flow_series
for each row execute procedure public.set_updated_at();
create trigger set_finance_cash_flow_definitions_updated_at before update on public.finance_cash_flow_definitions
for each row execute procedure public.set_updated_at();
create trigger set_finance_cash_flow_specific_dates_updated_at before update on public.finance_cash_flow_specific_dates
for each row execute procedure public.set_updated_at();
create trigger set_finance_cash_flow_occurrences_updated_at before update on public.finance_cash_flow_occurrences
for each row execute procedure public.set_updated_at();

-- ----------
-- ROW LEVEL SECURITY
-- ----------
alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_account_balance_snapshots enable row level security;
alter table public.finance_assumption_series enable row level security;
alter table public.finance_assumption_values enable row level security;
alter table public.finance_cash_flow_series enable row level security;
alter table public.finance_cash_flow_definitions enable row level security;
alter table public.finance_cash_flow_specific_dates enable row level security;
alter table public.finance_cash_flow_occurrences enable row level security;
alter table public.finance_forecast_runs enable row level security;
alter table public.finance_daily_liquidity_forecasts enable row level security;

create policy "finance_categories_member" on public.finance_categories
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_accounts_member" on public.finance_accounts
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_account_balance_snapshots_member" on public.finance_account_balance_snapshots
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_assumption_series_member" on public.finance_assumption_series
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_assumption_values_member" on public.finance_assumption_values
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_cash_flow_series_member" on public.finance_cash_flow_series
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_cash_flow_definitions_member" on public.finance_cash_flow_definitions
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_cash_flow_specific_dates_member" on public.finance_cash_flow_specific_dates
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_cash_flow_occurrences_member" on public.finance_cash_flow_occurrences
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_forecast_runs_member" on public.finance_forecast_runs
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "finance_daily_liquidity_forecasts_member" on public.finance_daily_liquidity_forecasts
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
