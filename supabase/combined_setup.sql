-- =============================================================
-- HUSHOLDNINGSAPP – KOMPLETT DATABASE SETUP
-- Kjør denne én gang i Supabase SQL Editor
-- =============================================================

-- Enable required extension.
create extension if not exists pgcrypto;

-- ENUM TYPES
create type public.household_role as enum ('owner', 'adult', 'member');
create type public.measurement_type as enum ('height', 'weight', 'head_circumference', 'shoe_size', 'other');
create type public.assignment_type as enum ('dropoff', 'pickup');
create type public.calendar_event_type as enum ('general', 'child', 'family', 'appointment', 'work', 'activity', 'other');
create type public.meal_type as enum ('dinner', 'breakfast', 'lunch', 'snack');
create type public.recipe_source_type as enum ('internal', 'external', 'hybrid');
create type public.note_type as enum ('general', 'preference', 'practical', 'memory', 'other');

-- BASE TABLES
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null,
  joined_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, user_id)
);

-- CHILDREN DOMAIN
create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 120),
  middle_name text,
  last_name text,
  nickname text,
  date_of_birth date,
  sex text,
  profile_image_url text,
  notes text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table public.child_measurements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  measurement_type public.measurement_type not null,
  value numeric(10,2) not null,
  unit text not null check (char_length(unit) between 1 and 20),
  measured_at date not null,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (value > 0),
  check (
    (measurement_type = 'height' and unit in ('cm', 'm')) or
    (measurement_type = 'weight' and unit in ('kg', 'g')) or
    (measurement_type = 'head_circumference' and unit in ('cm', 'mm')) or
    (measurement_type = 'shoe_size' and unit in ('eu', 'us', 'uk', 'cm')) or
    (measurement_type = 'other')
  )
);

create table public.child_quotes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  quote_text text not null check (char_length(quote_text) between 1 and 2000),
  quoted_at date not null,
  context text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table public.child_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  title text,
  content text not null check (char_length(content) between 1 and 4000),
  note_type public.note_type not null default 'general',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.child_milestones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  occurred_at date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- SHOPPING DOMAIN
create table public.shopping_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, name)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category_id uuid references public.shopping_categories(id),
  quantity numeric(10,2),
  unit text,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  archived_at timestamptz
);

-- CALENDAR + CHILDCARE + MEALS
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  event_type public.calendar_event_type not null default 'general',
  location text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  check (ends_at >= starts_at)
);

create table public.calendar_event_children (
  calendar_event_id uuid not null references public.calendar_events(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (calendar_event_id, child_id)
);

create table public.childcare_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  child_id uuid references public.children(id) on delete set null,
  assignment_type public.assignment_type not null,
  assigned_person_id uuid not null references public.profiles(id),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  meal_type public.meal_type not null default 'dinner',
  recipe_id uuid,
  custom_title text,
  external_recipe_url text,
  servings integer,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- RECIPES DOMAIN
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 240),
  description text,
  source_type public.recipe_source_type not null default 'internal',
  source_url text,
  servings integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  category text,
  instructions_text text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

alter table public.meal_plans
  add constraint meal_plans_recipe_id_fkey
  foreign key (recipe_id) references public.recipes(id) on delete set null;

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique check (char_length(canonical_name) between 1 and 240),
  default_shopping_category_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.ingredients
  add constraint ingredients_default_shopping_category_id_fkey
  foreign key (default_shopping_category_id) references public.shopping_categories(id) on delete set null;

create table public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 240),
  created_at timestamptz not null default timezone('utc', now()),
  unique (ingredient_id, alias)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  raw_name text not null check (char_length(raw_name) between 1 and 240),
  quantity numeric(10,2),
  unit text,
  note text,
  optional boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- PANTRY (future)
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  name text not null check (char_length(name) between 1 and 240),
  quantity numeric(10,2),
  unit text,
  always_in_stock boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- INDEXES
create index idx_household_members_household_user on public.household_members(household_id, user_id);
create index idx_children_household on public.children(household_id);
create index idx_child_measurements_child_date on public.child_measurements(child_id, measured_at desc);
create index idx_child_quotes_child_date on public.child_quotes(child_id, quoted_at desc);
create index idx_child_notes_child on public.child_notes(child_id);
create index idx_shopping_items_household_completed on public.shopping_items(household_id, completed, archived_at);
create index idx_calendar_events_household_start on public.calendar_events(household_id, starts_at);
create index idx_childcare_assignments_household_date on public.childcare_assignments(household_id, date);
create index idx_meal_plans_household_date on public.meal_plans(household_id, meal_date);
create index idx_recipes_household_archived on public.recipes(household_id, archived_at);
create index idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id, sort_order);
create index idx_audit_log_household_created on public.audit_log(household_id, created_at desc);

-- HELPER FUNCTIONS
create or replace function public.current_profile_id()
returns uuid language sql stable as $$
  select p.id from public.profiles p where p.auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where hm.household_id = target_household and p.auth_user_id = auth.uid()
  )
$$;

create or replace function public.has_household_role(target_household uuid, accepted_roles text[])
returns boolean language sql stable as $$
  select exists (
    select 1 from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where hm.household_id = target_household
      and p.auth_user_id = auth.uid()
      and hm.role::text = any (accepted_roles)
  )
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

-- TRIGGERS
create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger set_households_updated_at before update on public.households for each row execute procedure public.set_updated_at();
create trigger set_household_members_updated_at before update on public.household_members for each row execute procedure public.set_updated_at();
create trigger set_children_updated_at before update on public.children for each row execute procedure public.set_updated_at();
create trigger set_child_measurements_updated_at before update on public.child_measurements for each row execute procedure public.set_updated_at();
create trigger set_child_quotes_updated_at before update on public.child_quotes for each row execute procedure public.set_updated_at();
create trigger set_child_notes_updated_at before update on public.child_notes for each row execute procedure public.set_updated_at();
create trigger set_child_milestones_updated_at before update on public.child_milestones for each row execute procedure public.set_updated_at();
create trigger set_shopping_categories_updated_at before update on public.shopping_categories for each row execute procedure public.set_updated_at();
create trigger set_shopping_items_updated_at before update on public.shopping_items for each row execute procedure public.set_updated_at();
create trigger set_calendar_events_updated_at before update on public.calendar_events for each row execute procedure public.set_updated_at();
create trigger set_childcare_assignments_updated_at before update on public.childcare_assignments for each row execute procedure public.set_updated_at();
create trigger set_meal_plans_updated_at before update on public.meal_plans for each row execute procedure public.set_updated_at();
create trigger set_recipes_updated_at before update on public.recipes for each row execute procedure public.set_updated_at();
create trigger set_ingredients_updated_at before update on public.ingredients for each row execute procedure public.set_updated_at();
create trigger set_recipe_ingredients_updated_at before update on public.recipe_ingredients for each row execute procedure public.set_updated_at();

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.children enable row level security;
alter table public.child_measurements enable row level security;
alter table public.child_quotes enable row level security;
alter table public.child_notes enable row level security;
alter table public.child_milestones enable row level security;
alter table public.shopping_categories enable row level security;
alter table public.shopping_items enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_children enable row level security;
alter table public.childcare_assignments enable row level security;
alter table public.meal_plans enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.pantry_items enable row level security;
alter table public.audit_log enable row level security;

-- RLS POLICIES – profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = auth_user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = auth_user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);

-- RLS POLICIES – households
create policy "households_select_member" on public.households for select using (public.is_household_member(id));
create policy "households_insert_authenticated" on public.households for insert with check (auth.uid() is not null);
create policy "households_update_owner" on public.households for update using (public.has_household_role(id, array['owner'])) with check (public.has_household_role(id, array['owner']));

-- RLS POLICIES – household_members
create policy "household_members_select_member" on public.household_members for select using (public.is_household_member(household_id));
create policy "household_members_insert_self_owner" on public.household_members for insert with check (
  user_id = public.current_profile_id() and role = 'owner'
  and exists (select 1 from public.households h where h.id = household_id and h.created_by = public.current_profile_id())
);
create policy "household_members_update_owner" on public.household_members for update using (public.has_household_role(household_id, array['owner'])) with check (public.has_household_role(household_id, array['owner']));
create policy "household_members_delete_owner" on public.household_members for delete using (public.has_household_role(household_id, array['owner']));

-- RLS POLICIES – children
create policy "children_select_member" on public.children for select using (public.is_household_member(household_id));
create policy "children_modify_adult" on public.children for all using (public.has_household_role(household_id, array['owner', 'adult'])) with check (public.has_household_role(household_id, array['owner', 'adult']));

-- RLS POLICIES – domain tables (member access)
create policy "child_measurements_member" on public.child_measurements for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "child_quotes_member" on public.child_quotes for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "child_notes_member" on public.child_notes for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "child_milestones_member" on public.child_milestones for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "shopping_categories_member" on public.shopping_categories for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "shopping_items_member" on public.shopping_items for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "calendar_events_member" on public.calendar_events for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "calendar_event_children_member" on public.calendar_event_children for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "childcare_assignments_member" on public.childcare_assignments for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "meal_plans_member" on public.meal_plans for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "recipes_member" on public.recipes for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "recipe_ingredients_member" on public.recipe_ingredients for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "pantry_items_member" on public.pantry_items for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "audit_log_member_read" on public.audit_log for select using (public.is_household_member(household_id));
create policy "audit_log_insert_member" on public.audit_log for insert with check (public.is_household_member(household_id));
