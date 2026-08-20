-- Migration 0001 — Selykai Company Intelligence Engine foundation v0.2
-- Applied to Neon project CompanyIntelligenceEngineBySelykai on 2026-08-20.
-- FACT != INFERENCE: source facts, detected events and inferred signals are stored separately.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('official', 'commercial', 'web', 'inference')),
  base_url text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siren char(9) NOT NULL UNIQUE,
  legal_name text NOT NULL,
  display_name text,
  legal_form_code text,
  naf_code text,
  administrative_state text,
  employee_band text,
  company_category text,
  employer boolean,
  creation_date date,
  head_office_siret char(14),
  canonical_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  siret char(14) UNIQUE,
  is_head_office boolean NOT NULL DEFAULT false,
  administrative_state text,
  naf_code text,
  address text,
  postal_code text,
  city text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  opening_date date,
  closing_date date,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text,
  person_type text,
  provider_id text REFERENCES providers(id),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  provider_id text REFERENCES providers(id),
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, domain)
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name text,
  role text,
  email text,
  phone text,
  provider_id text REFERENCES providers(id),
  verification_status text,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES providers(id),
  fact_type text NOT NULL,
  fact_key text NOT NULL,
  value jsonb NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_url text,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_to timestamptz,
  fingerprint text NOT NULL,
  UNIQUE(company_id, provider_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS company_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_hash text NOT NULL,
  facts jsonb NOT NULL,
  first_captured_at timestamptz NOT NULL DEFAULT now(),
  last_captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, snapshot_hash)
);

CREATE TABLE IF NOT EXISTS company_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id),
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  evidence_keys text[] NOT NULL DEFAULT '{}',
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS company_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  label text NOT NULL,
  strength integer NOT NULL CHECK (strength >= 0 AND strength <= 100),
  reason text NOT NULL,
  evidence_event_types text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score_type text NOT NULL,
  score_version text NOT NULL,
  value integer NOT NULL CHECK (value >= 0 AND value <= 100),
  confidence text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  factors jsonb NOT NULL DEFAULT '[]',
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL REFERENCES providers(id),
  operation text NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  status text NOT NULL,
  http_status integer,
  latency_ms integer,
  estimated_cost_eur numeric(12,6) NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS api_cache (
  cache_key text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES providers(id),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_naf ON companies(naf_code);
CREATE INDEX IF NOT EXISTS idx_companies_state ON companies(administrative_state);
CREATE INDEX IF NOT EXISTS idx_establishments_company ON establishments(company_id);
CREATE INDEX IF NOT EXISTS idx_people_company ON company_people(company_id);
CREATE INDEX IF NOT EXISTS idx_domains_company ON company_domains(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON company_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_facts_company_last_seen ON company_facts(company_id, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_company_key ON company_facts(company_id, fact_key, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_company_captured ON company_snapshots(company_id, last_captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_company_date ON company_events(company_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_company_generated ON company_signals(company_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_company_type ON company_scores(company_id, score_type, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_runs_started ON provider_runs(provider_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON api_cache(expires_at);

INSERT INTO providers (id, name, kind, base_url, enabled)
VALUES
  ('recherche-entreprises', 'API Recherche d''entreprises', 'official', 'https://recherche-entreprises.api.gouv.fr', true),
  ('inpi-rne', 'INPI / RNE', 'official', 'https://data.inpi.fr', false),
  ('apilayer', 'APILayer', 'commercial', 'https://apilayer.com', false),
  ('hunter', 'Hunter', 'commercial', 'https://hunter.io', false),
  ('selykai-engine', 'Selykai Intelligence Engine', 'inference', NULL, true)
ON CONFLICT (id) DO NOTHING;
