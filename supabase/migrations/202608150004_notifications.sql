-- Push notification subscriptions and event queue

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_push_subscriptions_profile_id on public.push_subscriptions(profile_id);
create index idx_push_subscriptions_household_id on public.push_subscriptions(household_id);
create index idx_push_subscriptions_enabled on public.push_subscriptions(enabled);

create trigger set_push_subscriptions_updated_at before update on public.push_subscriptions
for each row execute procedure public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (profile_id = public.current_profile_id());

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (
    profile_id = public.current_profile_id()
    and (
      household_id is null
      or public.is_household_member(household_id)
    )
  );

create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (profile_id = public.current_profile_id())
  with check (
    profile_id = public.current_profile_id()
    and (
      household_id is null
      or public.is_household_member(household_id)
    )
  );

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (profile_id = public.current_profile_id());

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('shopping_item_added', 'message_posted', 'calendar_reminder')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index idx_notification_events_type_processed_created
  on public.notification_events(event_type, processed_at, created_at);

create index idx_notification_events_household_created
  on public.notification_events(household_id, created_at);

alter table public.notification_events enable row level security;

create policy "notification_events_select_household_members" on public.notification_events
  for select using (public.is_household_member(household_id));