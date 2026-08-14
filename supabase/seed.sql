-- Fictive seed data only. Never store real family data in repository.

insert into public.ingredients (canonical_name)
values
  ('milk'),
  ('banana'),
  ('salmon'),
  ('rice'),
  ('taco spice')
on conflict (canonical_name) do nothing;

-- Default shopping categories are inserted per household during onboarding
-- to avoid global leakage across tenants.
