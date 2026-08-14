# Decision

Use date-fns-compatible approach and `date-holidays` for Norway holiday data provider.

# Context

Calendar must support `nb-NO`, `Europe/Oslo`, and Norwegian holidays.

# Options considered

- Hardcoded holiday table
- date-holidays provider abstraction
- External paid holiday API

# Decision

Use provider abstraction with `NorwayHolidayProvider` backed by `date-holidays`.

# Consequences

- Easy to test and swap provider.
- Need periodic dependency maintenance.
