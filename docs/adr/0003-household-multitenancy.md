# Decision

Enforce household multitenancy via `household_id` and PostgreSQL RLS.

# Context

Multiple families must never access each other's data.

# Options considered

- App-layer filtering only
- Separate database per household
- Shared schema with RLS

# Decision

Choose shared schema + strict RLS.

# Consequences

- Strong tenant isolation if policies are correct.
- Requires explicit RLS testing for every new table.
