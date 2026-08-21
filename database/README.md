# Database — Selykai Company Intelligence Engine

## Production database

- Provider: Neon via Vercel Marketplace
- Project: `CompanyIntelligenceEngineBySelykai`
- Region: EU Central / Frankfurt
- PostgreSQL: 18
- Default database: `neondb`
- Managed Neon Auth: provisioned

No connection string or credential is stored in Git.

## Applied migrations

### 0001 — Foundation V0.2

Applied on 2026-08-20 after validation on an isolated Neon branch.

Migration workflow ID: `7678dfef-f07f-4bc7-b28f-479c4f02d726`

Foundation created for providers, companies, establishments, people, domains, contacts, sourced facts, snapshots, events, signals, scores, provider-run observability and API cache.

Production smoke test: company insertion, facts, snapshots, events, signals, scores and cascading cleanup.

### 0002 — Workspaces, watchlists and alerts

Applied on 2026-08-20 after validation on an isolated Neon branch.

Migration workflow ID: `cee996ea-52b3-4711-9a0e-511fc05ad9c4`

Adds:

- workspaces ;
- workspace memberships ;
- watchlists ;
- companies monitored per watchlist ;
- daily / weekly / manual monitoring cadence ;
- deduplicated intelligence alerts.

Validation covered cross-workspace isolation, due-target selection, alert deduplication, scheduling of the next check and cascading cleanup. A second smoke test was executed successfully after promotion to Neon main.

### 0003 — BODACC provider

Adds BODACC / DILA to the provider registry so legal-event facts retain their official provenance when persisted.

### 0004 — Momentum V0.5 providers

Applied on 2026-08-21 after validation on the isolated Neon branch `br-frosty-art-b2tsfqoz`, then promoted exactly to `main` and the temporary branch was deleted.

Adds BOAMP / DILA as an official provider for public-procurement attribution evidence. No application table shape changes are introduced by this migration.

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
