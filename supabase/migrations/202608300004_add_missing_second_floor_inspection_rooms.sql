insert into public.inspection_rooms (inspection_id, household_id, name, code, area, sort_order)
select inspections.id, inspections.household_id, additions.name, additions.code, 'upper_floor', additions.sort_order
from public.inspections inspections
cross join (values
  ('Soverom 4', 'SOV4', 80),
  ('Bod 2. etasje', 'BOD2', 81),
  ('Bad soverom 2', 'BAD2', 82),
  ('Gang 2. etasje', 'GANG2', 83),
  ('Balkong ved soverom 3', 'BALKONG', 84)
) as additions(name, code, sort_order)
where not exists (
  select 1
  from public.inspection_rooms existing
  where existing.inspection_id = inspections.id and existing.code = additions.code
);

insert into public.inspection_checkpoints (inspection_id, room_id, household_id, category, title, guidance, sort_order)
select rooms.inspection_id, rooms.id, rooms.household_id, checkpoints.category, checkpoints.title, checkpoints.guidance, checkpoints.sort_order
from public.inspection_rooms rooms
join (values
  ('SOV4', 'Overflater', 'Riper, hakk eller skader', null, 1),
  ('SOV4', 'Overflater', 'Malingsfeil, sparkelskjoter eller sprekker', null, 2),
  ('SOV4', 'Dorer og vinduer', 'Apne og lukke uten subbing', null, 3),
  ('SOV4', 'Gulv', 'Knirk, svikt, ujevnheter og skader', null, 4),
  ('BOD2', 'Bod', 'Gulv, vegger, tak og lister uten skader', null, 1),
  ('BOD2', 'Bod', 'Dor, karm og handtak fungerer uten subbing', null, 2),
  ('BOD2', 'Bod', 'Ventilasjon, fukt og eventuelle stikk', null, 3),
  ('BAD2', 'Bad', 'Fall mot sluk og ingen vannansamling', 'Spre litt vann pa gulvet. Vannet skal renne mot sluket uten a bli staende i pytter. Kontroller ogsa ved dor, vegg og i dusjsonen.', 1),
  ('BAD2', 'Bad', 'Fliser, fuging, silikon, sluk og rorgjennomforinger', null, 2),
  ('BAD2', 'Bad', 'Dusj, servant, toalett, blandebatteri og lekkasjer', 'Apne kaldt og varmt vann, la det renne noen minutter og kontroller koblinger, skap og gulv for fukt. Spyl toalettet flere ganger.', 3),
  ('BAD2', 'Bad', 'Ventilasjon, termostat og gulvvarme', null, 4),
  ('BAD2', 'Elektro', 'Downlights, speilbelysning og IP-klassifiserte punkter', 'Test brytere, dimmere og stikk med lader eller lampe. Kontroller plassering mot tilvalgstegning og noter avvik med bilde.', 5),
  ('GANG2', 'Overflater', 'Riper, hakk eller skader', null, 1),
  ('GANG2', 'Dorer og vinduer', 'Apne og lukke uten subbing', null, 2),
  ('GANG2', 'Gulv', 'Knirk, svikt, ujevnheter og skader', null, 3),
  ('GANG2', 'Elektro', 'Downlights, lysdemper, brytere og stikk', 'Test brytere, dimmere og stikk med lader eller lampe. Kontroller plassering mot tilvalgstegning og noter avvik med bilde.', 4),
  ('GANG2', 'Elektro', 'Rokdetektor og lampepunkt', 'Test rokdetektoren med testknapp. Kontroller ogsa at lampepunkt er montert som avtalt.', 5),
  ('BALKONG', 'Utvendig', 'Balkonggulv, fall og avrenning', 'Kontroller visuelt at vann ledes bort fra fasaden og ikke samler seg mot dor eller vegg.', 1),
  ('BALKONG', 'Utvendig', 'Rekkverk, innfesting og overflater', null, 2),
  ('BALKONG', 'Dorer og vinduer', 'Balkongdor, terskel, karm og tetting', null, 3),
  ('BALKONG', 'Elektro', 'Utebelysning og stikk dersom levert', 'Test brytere og stikk med lader eller lampe.', 4)
) as checkpoints(room_code, category, title, guidance, sort_order) on checkpoints.room_code = rooms.code
where not exists (
  select 1
  from public.inspection_checkpoints existing
  where existing.room_id = rooms.id and existing.title = checkpoints.title
);