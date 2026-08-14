# Decision

Model meal planning as its own domain and surface it inside calendar UI.

# Context

Users expect dinners in calendar, but data should remain modular.

# Options considered

- Store meals as calendar events
- Dedicated `meal_plans` table and calendar read model

# Decision

Choose dedicated `meal_plans` + calendar composition.

# Consequences

- Better future extensibility for recipe/shopping integration.
- Requires read-model aggregation in calendar queries.
