create table public.inspection_measurements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  room_id uuid not null references public.inspection_rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  length_cm numeric(10,2),
  width_cm numeric(10,2),
  height_cm numeric(10,2),
  depth_cm numeric(10,2),
  note text,
  photo_path text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  check (length_cm is null or length_cm > 0),
  check (width_cm is null or width_cm > 0),
  check (height_cm is null or height_cm > 0),
  check (depth_cm is null or depth_cm > 0)
);

create index idx_inspection_measurements_room_created on public.inspection_measurements(room_id, created_at desc);
alter table public.inspection_measurements enable row level security;
create policy "inspection_measurements_member" on public.inspection_measurements
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));