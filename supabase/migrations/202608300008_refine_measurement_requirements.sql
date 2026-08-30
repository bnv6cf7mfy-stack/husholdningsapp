update public.inspection_measurements
set name = 'Vindu - innvendige mål for plisse-gardiner'
where name = 'Vindu';

insert into public.inspection_measurements (household_id, inspection_id, room_id, name, created_by)
select rooms.household_id, rooms.inspection_id, rooms.id, requirements.name, inspections.created_by
from public.inspection_rooms rooms
join public.inspections inspections on inspections.id = rooms.inspection_id
join (values
  ('STUE', 'Gardinstang ved terrassedor'),
  ('SOV2', 'Gardinstang ved fransk balkong')
) as requirements(room_code, name) on requirements.room_code = rooms.code
where not exists (
  select 1 from public.inspection_measurements existing
  where existing.room_id = rooms.id and existing.name = requirements.name
);