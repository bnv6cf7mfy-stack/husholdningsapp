# Decision

Model children as first-class domain entities.

# Context

Child profile/history is central product functionality.

# Options considered

- Generic household people table only
- Dedicated children domain tables

# Decision

Choose dedicated children domain.

# Consequences

- Better semantics and long-term extensibility.
- More tables and domain logic to maintain.
