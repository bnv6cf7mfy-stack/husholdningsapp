# Decision

All private family media must use private object storage with household-scoped access checks.

# Context

Child photos are highly sensitive.

# Options considered

- Public bucket URLs
- Private buckets with signed access

# Decision

Choose private buckets only.

# Consequences

- Strong privacy posture.
- Requires signed URL flow and policy maintenance.
