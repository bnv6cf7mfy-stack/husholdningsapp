-- Household messages for member-to-member communication
create table public.household_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create index idx_household_messages_household_created
  on public.household_messages(household_id, created_at desc);

create trigger set_household_messages_updated_at before update on public.household_messages
for each row execute procedure public.set_updated_at();

alter table public.household_messages enable row level security;

create policy "household_messages_select_members" on public.household_messages
  for select using (public.is_household_member(household_id));

create policy "household_messages_insert_members" on public.household_messages
  for insert with check (
    public.is_household_member(household_id)
    and author_id = public.current_profile_id()
  );

create policy "household_messages_update_own" on public.household_messages
  for update using (author_id = public.current_profile_id())
  with check (author_id = public.current_profile_id());
