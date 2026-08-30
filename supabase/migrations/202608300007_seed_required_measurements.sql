insert into public.inspection_measurements (household_id, inspection_id, room_id, name, created_by)
select rooms.household_id, rooms.inspection_id, rooms.id, requirements.name, inspections.created_by
from public.inspection_rooms rooms
join public.inspections inspections on inspections.id = rooms.inspection_id
join (values
  ('SOV1', 'Vindu'), ('SOV1', 'Garderobeskap'), ('SOV1', 'Rommet: lengde og bredde'),
  ('SOV2', 'Vindu'), ('SOV2', 'Garderobeskap'), ('SOV2', 'Rommet: lengde og bredde'),
  ('SOV3', 'Vindu'), ('SOV3', 'Garderobeskap'), ('SOV3', 'Rommet: lengde og bredde'),
  ('SOV4', 'Vindu'), ('SOV4', 'Garderobeskap'), ('SOV4', 'Rommet: lengde og bredde'),
  ('GANG2', 'Oppbevaring gang 2. etasje'),
  ('STUE', 'TV-vegg'),
  ('TRAPP', 'Trapp'),
  ('GANG', 'Garderobeskap gang'),
  ('BOD2', 'Bod 2. etasje'),
  ('BOD', 'Ekstern bod')
) as requirements(room_code, name) on requirements.room_code = rooms.code
where not exists (
  select 1 from public.inspection_measurements existing
  where existing.room_id = rooms.id and existing.name = requirements.name
);