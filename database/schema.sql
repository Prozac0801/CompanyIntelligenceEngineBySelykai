-- Selykai Company Intelligence Engine — PostgreSQL foundation
-- Applied only after the Git repository is validated and a dedicated Neon project is created.

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
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text,
  person_type text,
  provider_id text REFERENCES providers(id),
  observed_at timestamptz NOT NULL DEFAULT now()
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
  observed_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_to timestamptz,
  fingerprint text NOT NULL,
  UNIQUE(company_id, provider_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS company_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id),
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  event_date timestamptz,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  evidence_fact_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_facts_company_observed ON company_facts(company_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_company_date ON company_events(company_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_scores_company_type ON company_scores(company_id, score_type, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_runs_started ON provider_runs(provider_id, started_at DESC);

INSERT INTO providers (id, name, kind, base_url, enabled)
VALUES
  ('recherche-entreprises', 'API Recherche d''entreprises', 'official', 'https://recherche-entreprises.api.gouv.fr', true),
  ('inpi-rne', 'INPI / RNE', 'official', 'https://data.inpi.fr', false),
  ('apilayer', 'APILayer', 'commercial', 'https://apilayer.com', false),
  ('hunter', 'Hunter', 'commercial', 'https://hunter.io', false)
ON CONFLICT (id) DO NOTHING;
