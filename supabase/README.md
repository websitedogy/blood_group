# LIFELOOP AI - Database Architecture & Migration Strategy

## 1. Overview
The database layer is built on PostgreSQL with PostGIS extensions hosted on Supabase.
All schema changes are versioned, idempotent, immutable, and tracked via sequential timestamped SQL files in `supabase/migrations/`.

## 2. Directory Structure
```
supabase/
  ├── config.toml           # Supabase local development config
  └── migrations/           # Versioned migration scripts
      └── 20261122000000_gate1_foundation_postgis.sql
```

## 3. Migration Execution Process
1. **Local Development & Testing**:
   Run `supabase db reset` or `supabase migration up` to test migrations locally against a containerized PostgreSQL instance.
2. **CI / Automation Gate**:
   Execute automated schema validation and pgTAP/SQL integration tests against a temporary test database.
3. **Production Deployment**:
   Apply migrations strictly through CI/CD deployment pipelines using `supabase db push`. Direct manual DDL changes on production databases are prohibited.

## 4. Rollback and Disaster Recovery
- Each migration includes forward definitions with defensive `IF NOT EXISTS` guards.
- Point-in-time recovery (PITR) is configured on the Supabase database.
- Breaking schema modifications require additive dual-write transitions prior to column deprecations.
