-- Fixes infinite RLS recursion: is_household_member()/has_household_role() are
-- not security definer, so the household_members RLS policies (which call
-- these functions) trigger the functions' own internal household_members
-- query to be re-evaluated under RLS again, recursing until Postgres raises
-- "stack depth limit exceeded" (54001). This affects every domain table, not
-- just Finance. Making these two functions SECURITY DEFINER with an explicit
-- search_path lets their internal lookups bypass RLS (they only ever return a
-- boolean membership/role check, no row data is exposed), breaking the cycle.

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where hm.household_id = target_household
      and p.auth_user_id = auth.uid()
  )
$$;

create or replace function public.has_household_role(target_household uuid, accepted_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where hm.household_id = target_household
      and p.auth_user_id = auth.uid()
      and hm.role::text = any (accepted_roles)
  )
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.has_household_role(uuid, text[]) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_role(uuid, text[]) to authenticated;
