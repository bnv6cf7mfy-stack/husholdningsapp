alter table public.development_suggestions
  add column area text check (
    area is null or area in (
      'kalender', 'handleliste', 'oppskrifter', 'barn',
      'økonomi', 'utvikling', 'generelt'
    )
  );
