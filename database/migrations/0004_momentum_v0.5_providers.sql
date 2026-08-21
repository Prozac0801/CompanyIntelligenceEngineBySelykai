-- Company Intelligence Engine V0.5 — official procurement source.
-- Idempotent provider registration; no application table shape changes.

INSERT INTO providers (id, name, kind, base_url, enabled)
VALUES (
  'boamp',
  'BOAMP / DILA',
  'official',
  'https://boamp-datadila.opendatasoft.com',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  base_url = EXCLUDED.base_url,
  enabled = EXCLUDED.enabled;
