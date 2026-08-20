# Deployment status

## Vercel

- Project: `companyintengine`
- Framework: Next.js
- Node.js: 24.x
- Git branch: `main`
- Production alias: `https://companyintengine.vercel.app`
- Neon Marketplace resource: `CompanyIntelligenceEngineBySelykai`

This file is intentionally committed after linking the Neon Marketplace resource so that Vercel performs a fresh deployment with the resource-provided environment variables available at build/runtime.

## Required runtime configuration

The deployed application expects these variables:

- `DATABASE_URL` — provided by the connected Neon resource
- `NEON_AUTH_BASE_URL` — Managed Neon Auth endpoint
- `NEON_AUTH_COOKIE_SECRET` — private cookie secret, minimum 32 characters
- `CRON_SECRET` — private secret used by Vercel Cron
- `MONITOR_BATCH_SIZE` — optional, defaults to 20
- `NEXT_PUBLIC_APP_URL` — production origin

Optional providers:

- `INPI_USERNAME`
- `INPI_PASSWORD`
- `APILAYER_API_KEY`
- `HUNTER_API_KEY`

Never commit secret values to Git.
