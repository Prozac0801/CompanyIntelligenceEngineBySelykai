# Neon dedicated database via Vercel

## Constraint observed

The current Neon organization is managed by Vercel. Direct project creation through the Neon API is rejected with `organization is managed by Vercel`.

The Company Intelligence Engine must **not** reuse the database of another Selykai product.

## Provisioning path

Provision a dedicated Neon resource through the Vercel Marketplace integration. This does not require deploying the application first.

Recommended resource name:

`CompanyIntelligenceEngineBySelykai`

Recommended region: EU Central / Frankfurt when the plan and integration expose that region, to stay aligned with the existing European infrastructure.

Vercel documents the integration flow through:

```bash
vercel install neon
```

The equivalent can be done from the Vercel Marketplace UI.

## After provisioning

1. Keep the Neon resource dedicated to this engine.
2. Do not commit connection strings or credentials to Git.
3. Apply `database/schema.sql` first on a temporary Neon branch.
4. Verify tables, constraints, provider seeds and basic read/write behavior.
5. Only after validation, apply the migration to the main Neon branch.
6. Later, when the Vercel application project is created, connect the marketplace resource to that project and expose the connection string as `DATABASE_URL`.

## Deployment order

```text
Git foundation validated
        ↓
Dedicated Neon resource
        ↓
Migration tested on Neon branch
        ↓
Migration applied to Neon main
        ↓
Final application verification
        ↓
Vercel project + Git integration
        ↓
Environment variables
        ↓
Preview deployment
        ↓
Production deployment
```

The application remains functional in live-source read-only mode when `DATABASE_URL` is absent. Historical facts, snapshots, events, signals and timeline become active once the database is connected.
