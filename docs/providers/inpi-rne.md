# Provider — INPI / RNE

Status: **implemented, disabled until credentials are configured**.

## Purpose

INPI/RNE supplements the primary company search source with authoritative registry data useful for:

- company identity cross-checks;
- legal form and creation data;
- corporate purpose;
- capital information when present;
- RNE diffusion flags;
- future differential monitoring of creations and modifications.

## Official endpoints

Production base:

`https://registre-national-entreprises.inpi.fr/api`

Authentication:

`POST /sso/login`

Company detail:

`GET /companies/{siren}`

The INPI technical documentation also exposes a differential endpoint for newly created or modified companies. This will be used by the monitoring worker rather than by interactive page loads.

## Authentication

The API authenticates with the INPI account email and password and returns a Bearer token.

Environment variables:

```text
INPI_USERNAME=
INPI_PASSWORD=
```

The adapter caches the returned token for a short period and retries authentication once after a `401`. Credentials and tokens must never be written to logs or persisted in the application database.

## Commercial reuse safeguard

The RNE payload may contain `diffusionCommerciale`.

The engine applies a conservative rule:

- `false` → commercial prospecting is **blocked**;
- `true` → no RNE opposition was observed, but licence and GDPR obligations still apply;
- missing/unknown → commercial enrichment must **not be assumed allowed**.

This safeguard must be checked before future contact-enrichment providers such as Hunter are called.

`diffusionINSEE` must also be preserved as a sourced fact because some company records are not freely redistributable by downstream reusers.

## Data provenance

Every RNE-derived fact uses provider id `inpi-rne`, observation time, source URL, confidence and a stable fingerprint. RNE facts do not overwrite facts from another provider; they are stored as additional evidence.

## Failure policy

INPI is a supplemental provider. An authentication failure, timeout or service error must not make the core company page unavailable. The engine continues with the primary public source and simply omits the RNE supplement for that observation.
