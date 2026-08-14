# Backup and Recovery

## Objective

Protect long-term family history data from accidental loss.

## Database backup

- use Supabase managed backups where plan supports it
- schedule regular logical export (`pg_dump`) to separate storage
- verify restore drills periodically

## Storage backup

- media assets in private buckets
- replicate/export bucket objects on a schedule

## Data export

Prepare household-scoped export process for:

- children profiles
- measurements
- quotes
- notes
- milestones
- calendar-relevant child history

## Recovery

- define RTO and RPO targets
- document who can perform recovery
- test full restore in non-production environment

## Plan limitations

Supabase free plan may have backup limitations; external export is mandatory for critical family history.
