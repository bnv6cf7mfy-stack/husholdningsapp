alter table public.inspection_checkpoints add column guidance text;

update public.inspection_checkpoints
set guidance = case
  when title = 'Fall mot sluk og ingen vannansamling' then 'Spre litt vann pa gulvet. Vannet skal renne mot sluket uten a bli staende i pytter. Kontroller ogsa ved dor, vegg og i dusjsonen.'
  when title = 'Fall mot sluk, vannansamlinger og stjernekapp i dusjsone' then 'Spre litt vann pa gulvet. Vannet skal renne mot sluket uten a bli staende i pytter. Kontroller ogsa ved dor, vegg og i dusjsonen.'
  when title = 'Fliser, fuging, silikon og sluk' then 'Se etter fliser som er lose, har hakk eller har ujevne fuger. Silikon skal vaere jevnt, sammenhengende og uten sprekker. Sluket skal sitte fast og vaere tilgjengelig for rengjoring.'
  when title = 'Dusj, servant, toalett, blandebatteri og lekkasjer' then 'Apne kaldt og varmt vann, la det renne noen minutter og kontroller koblinger, skap og gulv for fukt. Spyl toalettet flere ganger.'
  when title = 'Ventilasjon, termostat og gulvvarme' then 'Kontroller at ventilen gir luftstrom, at termostaten reagerer og at gulvet blir jevnt lunkent. Ikke forvent umiddelbar full varme.'
  when title = 'Sikringsskap, kursfortegnelse, nettverk og antall stikk' then 'Sammenhold kursfortegnelsen med rommene. Alle kurser skal vaere merket, sikringer skal vaere tilgjengelige, og avtalt nettverk/stikk skal vaere pa riktig sted.'
  when category = 'Elektro' then 'Test brytere, dimmere og stikk med lader eller lampe. Kontroller plassering mot tilvalgstegning og noter avvik med bilde.'
  else guidance
end;

insert into public.inspection_checkpoints (inspection_id, room_id, household_id, category, title, guidance, sort_order)
select rooms.inspection_id, rooms.id, rooms.household_id, additions.category, additions.title, additions.guidance, 200 + additions.sort_order
from public.inspection_rooms rooms
join (values
  ('KJ', 'Kjokken', 'Kjokkenbatteri Arm887 Brushed Nickel med uttrekk', 'Kontroller at riktig modell og overflate er levert. Test uttrekk, svingradius, kaldt/varmt vann og at det ikke lekker i skapet under vasken.', 1),
  ('KJ', 'Kjokken', 'Integrerte hvitevarer og korrekt modell', 'Sammenhold med bestilling. Kontroller fronter, spalter, innfesting, funksjon og at mikro har egen kurs som avtalt.', 2),
  ('WC', 'Bad og WC', 'Riva 50 servant og Tapwell VIC071 servantbatteri', 'Kontroller riktig farge og modell, jevne fuger mot vegg og at servant og blandebatteri er stabile uten lekkasje.', 1),
  ('BAD', 'Bad', 'Vannfordelingsskap og rorgjennomforinger', 'Kontroller at skap og rorgjennomforinger er tette, tilgjengelige og uten synlig fukt. Ta bilde av eventuelle avvik.', 1),
  ('GANG', 'Elektro', 'Rokdetektor og ringeklokke', 'Test rokdetektoren med testknapp og ringeklokken. Begge skal fungere og vaere montert slik elektroplanen viser.', 1),
  ('TEKN', 'Ventilasjon og varme', 'Ventilasjonsaggregat, filter og betjening', 'Kontroller at aggregatet starter, at filter er montert og at dere far utlevert brukerveiledning og innstillingene.', 1),
  ('TERR', 'Utvendig', 'Terrassefall og vannavrenning', 'Kontroller visuelt at vann ledes bort fra fasaden og ikke samler seg mot dor eller vegg.', 1),
  ('BOD', 'Bod', 'Fukt, ventilasjon og strom i bod', 'Se etter misfarging eller lukt, kontroller lufting og test stikk med lader eller lampe.', 1)
) as additions(room_code, category, title, guidance, sort_order) on additions.room_code = rooms.code
where not exists (
  select 1 from public.inspection_checkpoints existing
  where existing.room_id = rooms.id and existing.title = additions.title
);

create table public.ballerud_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (category in ('plan', 'electrical', 'selection', 'prospect', 'contract', 'other')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_ballerud_documents_household_created on public.ballerud_documents(household_id, created_at desc);
alter table public.ballerud_documents enable row level security;
create policy "ballerud_documents_member" on public.ballerud_documents
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ballerud-documents', 'ballerud-documents', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;