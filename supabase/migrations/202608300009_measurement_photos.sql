create table public.inspection_measurement_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  measurement_id uuid not null references public.inspection_measurements(id) on delete cascade,
  storage_path text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_inspection_measurement_photos_measurement on public.inspection_measurement_photos(measurement_id, created_at);
alter table public.inspection_measurement_photos enable row level security;
create policy "inspection_measurement_photos_member" on public.inspection_measurement_photos
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

insert into public.inspection_measurement_photos (household_id, measurement_id, storage_path, created_by)
select measurements.household_id, measurements.id, measurements.photo_path, measurements.created_by
from public.inspection_measurements measurements
where measurements.photo_path is not null
on conflict (storage_path) do nothing;