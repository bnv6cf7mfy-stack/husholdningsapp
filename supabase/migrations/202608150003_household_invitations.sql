-- household_invitations: secure token-based partner invitation
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_household_invitations_token on public.household_invitations(token);
create index idx_household_invitations_household on public.household_invitations(household_id);

alter table public.household_invitations enable row level security;

-- Owner can create invitations for their household
create policy "household_invitations_insert_owner" on public.household_invitations
  for insert with check (
    invited_by in (
      select p.id from public.profiles p
      join public.household_members hm on hm.user_id = p.id
      where hm.household_id = household_invitations.household_id
        and hm.role = 'owner'
        and p.auth_user_id = auth.uid()
    )
  );

-- Owner can view invitations for their household
create policy "household_invitations_select_owner" on public.household_invitations
  for select using (
    household_id in (
      select hm.household_id from public.household_members hm
      join public.profiles p on p.id = hm.user_id
      where p.auth_user_id = auth.uid()
        and hm.role = 'owner'
    )
  );
