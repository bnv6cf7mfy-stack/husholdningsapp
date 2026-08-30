do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inspection_checkpoints'
  ) then
    alter publication supabase_realtime add table public.inspection_checkpoints;
  end if;
end;
$$;