# Decision

Use generalized `child_measurements` model with type/value/unit and numeric precision.

# Context

Need height/weight now and more measurement types later.

# Options considered

- Fixed columns per metric
- Generic measurement rows

# Decision

Choose generic measurement rows with enum type.

# Consequences

- Flexible extension for future metrics.
- Requires input validation and unit constraints.
