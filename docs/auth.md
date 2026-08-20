# Authentication

Selykai Company Intelligence Engine uses **Managed Neon Auth** for the protected workspace surface.

## Why this choice

- Auth is already provisioned with the dedicated Neon project.
- User/session data branches with the database.
- The public company search remains independent from authentication.
- Workspace tables remain application-owned and reference opaque user IDs, so the business model is not coupled to Neon Auth internals.

## Package

`@neondatabase/auth` is pinned to `0.5.0-beta` because Managed Neon Auth is currently beta. Do not use a floating `latest` version in production.

## Required environment variables

```text
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
```

`NEON_AUTH_COOKIE_SECRET` must be at least 32 characters and server-side only.

The current dedicated Neon project already has Managed Auth provisioned. Its URL must be configured in Vercel when the application project is created; it is intentionally not hard-coded in the repository.

## Protected routes

`proxy.ts` protects:

```text
/workspace/:path*
```

The following remain public:

- `/`
- `/company/{siren}`
- `/api/v1/companies/search`
- `/api/v1/companies/{siren}`
- `/api/health`

The monitoring worker is protected separately with `CRON_SECRET`.

## User bootstrap

On first authenticated visit to `/workspace`:

1. the session user ID is read from Neon Auth;
2. a personal workspace is created if none exists;
3. the user becomes owner of that workspace;
4. a default `À surveiller` watchlist is created;
5. subsequent requests reuse the same workspace.

The personal workspace slug contains only a SHA-256-derived suffix, not the user's email or name.

## Security boundary

The browser never receives the database connection string. Workspace authorization is enforced by server-side queries that require a matching `workspace_members.user_id`.

If a future Data API or direct browser database access is enabled, PostgreSQL RLS must be added before exposing any workspace tables.
