# Security Model

## Core principles

- Least privilege and defense in depth.
- Household tenant isolation is mandatory.
- Child data treated as especially private.
- No public access paths for private household data.

## Authentication

- Supabase Auth for register/login/logout/password reset/session.
- No custom password storage.

## Authorization

- PostgreSQL RLS on all tenant-bound tables.
- Access decided by membership in `household_members`.
- Elevated edits (children core profile) restricted to `owner`/`adult` roles.

## Data protection

- `household_id` on private domain tables.
- Input validation with Zod in application layer.
- Foreign keys, check constraints and indexes enforced in schema.
- No secrets in repository.

## Logging and audit

- `audit_log` for who-did-what events.
- Separate technical application logs in app runtime.
- Never log passwords, tokens, cookies, secrets, or unnecessary sensitive free text.

## Child data safeguards

- No public profile URLs.
- Robots indexing disabled.
- Private storage buckets required for any child media.
- No unnecessary third-party tracking.

## Threat focus

- Broken access control / IDOR
- Injection
- XSS
- CSRF
- Misconfigured storage access

## Operational controls

- GitHub Actions CI checks: lint, typecheck, unit tests, build.
- Dependency updates and vulnerability scanning enabled in repository settings.
- Production only from `main`.
