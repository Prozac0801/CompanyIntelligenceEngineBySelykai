# Deployment status

## Production topology

- Vercel project: `companyintengine`
- Framework: Next.js 16.3
- Node.js: 24.x
- Git production branch: `main`
- Production alias: `https://companyintengine.vercel.app`
- Vercel Node Functions region: `fra1` (Frankfurt)
- Neon resource: `CompanyIntelligenceEngineBySelykai`
- Neon region: AWS `eu-central-1` (Frankfurt)
- PostgreSQL: 18

V0.5.10 pins normal Vercel server compute to Frankfurt so database-heavy requests no longer make a transatlantic round trip between `iad1` and Neon Frankfurt. Static assets continue to use Vercel's global delivery network.

## Required runtime configuration

The deployed application expects:

- `DATABASE_URL` — provided by the connected Neon resource ;
- `NEON_AUTH_BASE_URL` or the Vercel-generated Neon Auth alias ;
- `NEON_AUTH_COOKIE_SECRET` — private cookie secret, minimum 32 characters ;
- `CRON_SECRET` — private secret used by Vercel Cron ;
- `MONITOR_BATCH_SIZE` — optional, defaults to 20 ;
- `MONITOR_CONCURRENCY` — optional, defaults to 2 and is hard-capped at 4 ;
- `NEXT_PUBLIC_APP_URL` — production origin.

Optional providers:

- `INPI_USERNAME`
- `INPI_PASSWORD`
- `APILAYER_API_KEY`
- `HUNTER_API_KEY`

Never commit secret values to Git.

## Deployment checks

After every production deployment of the runtime layer:

1. open `/api/health` and confirm engine version, database reachability, schema readiness and auth configuration ;
2. inspect `x-vercel-id` or deployment metadata and confirm the function executes in `fra1` ;
3. compare database health latency against the pre-V0.5.10 baseline of roughly 352 ms observed while functions executed in `iad1` ;
4. verify provider capability diagnostics do not expose API keys ;
5. inspect Vercel runtime error clusters for new regressions ;
6. compare `provider_runs` before/after deployment, especially APILayer authentication failures and INPI authentication frequency.

The deployment is considered healthy only after these runtime checks. A successful build alone does not prove regional routing or provider behavior.

## Git / preview policy

Feature, fix and chore branches are not automatically deployed by Vercel. GitHub Actions remains the verification runtime for branches. Production deployment occurs from `main` after integration.

Preview/runtime write guards remain in place so non-production execution cannot silently pollute production intelligence state.
