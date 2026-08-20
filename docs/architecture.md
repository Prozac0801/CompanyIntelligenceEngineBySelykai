# Architecture — Company Intelligence Engine

## Principle

The engine is provider-agnostic. Product code consumes the normalized `CompanyProfile`, never a vendor payload directly.

```text
HTTP/API/UI
   ↓
Provider adapters
   ↓
Normalized company model
   ↓
Facts + provenance
   ↓
Events / snapshots
   ↓
Explainable scoring
   ↓
Inferences
```

## Non-negotiable rule

**FACT ≠ INFERENCE.**

A source fact is immutable evidence with provider, observation date, confidence and source URL. A score or AI conclusion references evidence but never replaces it.

## Provider strategy

- `recherche-entreprises`: live foundation provider, free/open, France.
- `inpi-rne`: legal events, filings and financial documents.
- `apilayer`: web/email/geolocation/news enrichment behind an adapter.
- `hunter`: professional contact enrichment on demand only.

Every commercial provider must be swappable without modifying the normalized domain model.

## Persistence strategy

A dedicated Neon project will be created only after the Git foundation is validated. `database/schema.sql` is the initial migration source of truth.

The first persistence milestone stores:

1. canonical companies and establishments;
2. source facts and provider runs;
3. historical events and snapshots;
4. versioned scores and their factors;
5. cache/cost telemetry.

## Deployment strategy

Vercel is intentionally deferred until the branch passes CI and the repository structure is accepted. Environment secrets never belong in Git.
