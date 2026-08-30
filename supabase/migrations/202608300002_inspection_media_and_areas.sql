alter table public.inspection_rooms
  add column area text not null default 'ground_floor'
  check (area in ('ground_floor', 'upper_floor', 'outdoor_storage'));

update public.inspection_rooms
set area = case
  when code in ('SOV2', 'SOV3', 'BAD') then 'upper_floor'
  when code in ('TERR', 'HAGE', 'FASADE', 'BOD', 'TEKN') then 'outdoor_storage'
  else 'ground_floor'
end;

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  checkpoint_id uuid not null references public.inspection_checkpoints(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null check (content_type like 'image/%'),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  caption text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_inspection_photos_checkpoint on public.inspection_photos(checkpoint_id, created_at);

alter table public.inspection_photos enable row level security;

create policy "inspection_photos_member" on public.inspection_photos
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-media', 'inspection-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.inspection_checkpoints (inspection_id, room_id, household_id, category, title, sort_order)
select rooms.inspection_id, rooms.id, rooms.household_id, additions.category, additions.title, 100 + additions.sort_order
from public.inspection_rooms rooms
join (values
  ('GANG', 'Elektro', 'Kontroller ringeklokke, røykdetektor og lampepunkt ved inngang', 1),
  ('KJ', 'Elektro', 'Kontroller 14 avtalte ekstra punkter, plassering og riktig type stikk', 1),
  ('KJ', 'Elektro', 'Kontroller lampepunkt og dimmer over kjøkkenøy', 2),
  ('KJ', 'Elektro', 'Kontroller lampepunkt for spisebord og riktig plassering ved innredning', 3),
  ('STUE', 'Elektro', 'Kontroller stikk, takpunkt og downlights mot tilvalgstegning', 1),
  ('TRAPP', 'Elektro', 'Kontroller lampepunkt over trapp, endevender og lysdemper', 1),
  ('SOV1', 'Elektro', 'Kontroller avtalte takpunkt og stikk i soverom', 1),
  ('SOV2', 'Elektro', 'Kontroller avtalte takpunkt og stikk i soverom', 1),
  ('SOV3', 'Elektro', 'Kontroller avtalte takpunkt og stikk i soverom', 1),
  ('BAD', 'Elektro', 'Kontroller downlights, termostat, ventilasjonspanel og IP-klassifiserte punkter', 1),
  ('TEKN', 'Elektro', 'Kontroller sikringsskap mot kursfortegnelse og at hver kurs er merket', 1)
) as additions(room_code, category, title, sort_order) on additions.room_code = rooms.code
where not exists (
  select 1
  from public.inspection_checkpoints existing
  where existing.room_id = rooms.id and existing.title = additions.title
);