create type public.inspection_status as enum ('not_started', 'in_progress', 'completed');

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  inspection_date date not null default current_date,
  property_address text,
  inspection_type text not null default 'Ferdigbefaring' check (char_length(inspection_type) between 1 and 80),
  status public.inspection_status not null default 'not_started',
  participants text[] not null default '{}',
  general_notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.inspection_rooms (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text not null check (char_length(code) between 1 and 12),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (inspection_id, name),
  unique (inspection_id, code)
);

create table public.inspection_checkpoints (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  room_id uuid not null references public.inspection_rooms(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 80),
  title text not null check (char_length(title) between 1 and 300),
  sort_order integer not null default 0,
  checked_at timestamptz,
  checked_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_inspections_household_created on public.inspections(household_id, created_at desc);
create index idx_inspection_rooms_inspection_order on public.inspection_rooms(inspection_id, sort_order);
create index idx_inspection_checkpoints_room_order on public.inspection_checkpoints(room_id, sort_order);

create trigger set_inspections_updated_at before update on public.inspections
for each row execute procedure public.set_updated_at();
create trigger set_inspection_rooms_updated_at before update on public.inspection_rooms
for each row execute procedure public.set_updated_at();
create trigger set_inspection_checkpoints_updated_at before update on public.inspection_checkpoints
for each row execute procedure public.set_updated_at();

alter table public.inspections enable row level security;
alter table public.inspection_rooms enable row level security;
alter table public.inspection_checkpoints enable row level security;

create policy "inspections_member" on public.inspections
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "inspection_rooms_member" on public.inspection_rooms
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "inspection_checkpoints_member" on public.inspection_checkpoints
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));