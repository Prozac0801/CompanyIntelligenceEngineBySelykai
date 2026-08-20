# Database — Selykai Company Intelligence Engine

## Production database

- Provider: Neon via Vercel Marketplace
- Project: `CompanyIntelligenceEngineBySelykai`
- Region: EU Central / Frankfurt
- PostgreSQL: 18
- Default database: `neondb`

No connection string or credential is stored in Git.

## Applied migrations

### 0001 — Foundation V0.2

Applied on 2026-08-20 after validation on an isolated Neon branch.

Neon migration workflow ID used during validation:

`7678dfef-f07f-4bc7-b28f-479c4f02d726`

The migration creates the foundation for:

- providers;
- companies and establishments;
- public company people;
- domains and contacts;
- sourced facts;
- immutable snapshots;
- detected events;
- inferred signals;
- explainable scores;
- provider-run observability;
- API cache.

The production smoke test covered company insertion, facts, snapshots, events, signals, scores and cascading cleanup.

## Migration policy

`database/schema.sql` is the cumulative schema reference.

`database/migrations/` contains the ordered migration history actually intended for production.

Future schema changes must follow this sequence:

1. update the code and migration file on a Git branch;
2. create a temporary Neon branch;
3. apply and test the migration there;
4. verify reads/writes and constraints;
5. apply the exact validated migration to the parent branch;
6. delete the temporary branch;
7. update this file.

Never make ad-hoc production schema changes that are absent from Git.
