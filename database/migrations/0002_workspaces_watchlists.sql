-- Migration 0002 — workspaces, watchlists and alerts
-- Auth-provider agnostic: user ids are opaque text values validated by the application layer.

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS watchlist_companies (
  watchlist_id uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  added_by_user_id text NOT NULL,
  monitor_frequency text NOT NULL DEFAULT 'daily' CHECK (monitor_frequency IN ('daily', 'weekly', 'manual')),
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  next_check_at timestamptz,
  notes text,
  PRIMARY KEY (watchlist_id, company_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  watchlist_id uuid REFERENCES watchlists(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id uuid REFERENCES company_events(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'medium', 'high', 'critical')),
  title text NOT NULL,
  body text,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (workspace_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_workspace ON watchlists(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_companies_due ON watchlist_companies(is_active, next_check_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_watchlist_companies_company ON watchlist_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_status ON alerts(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_company ON alerts(company_id, created_at DESC);
