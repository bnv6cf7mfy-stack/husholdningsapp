create table public.development_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  details text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'new' check (status in ('new', 'planned', 'done')),
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create index idx_development_suggestions_household_status
  on public.development_suggestions(household_id, status, created_at desc);

create trigger set_development_suggestions_updated_at before update on public.development_suggestions
for each row execute procedure public.set_updated_at();

alter table public.development_suggestions enable row level security;

create policy "development_suggestions_member" on public.development_suggestions
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
