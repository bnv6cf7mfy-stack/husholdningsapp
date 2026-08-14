-- Allow first owner membership insertion during household onboarding.

drop policy if exists "household_members_manage_owner" on public.household_members;

create policy "household_members_insert_self_owner" on public.household_members
for insert
with check (
  user_id = public.current_profile_id()
  and role = 'owner'
  and exists (
    select 1
    from public.households h
    where h.id = household_id
      and h.created_by = public.current_profile_id()
  )
);

create policy "household_members_update_owner" on public.household_members
for update using (public.has_household_role(household_id, array['owner']))
with check (public.has_household_role(household_id, array['owner']));

create policy "household_members_delete_owner" on public.household_members
for delete using (public.has_household_role(household_id, array['owner']));
