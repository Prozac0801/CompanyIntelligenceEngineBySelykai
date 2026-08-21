-- Migration 0003 — register official BODACC provider for Intelligence V0.4
INSERT INTO providers (id, name, kind, base_url, enabled)
VALUES ('bodacc', 'BODACC / DILA', 'official', 'https://bodacc-datadila.opendatasoft.com', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  base_url = EXCLUDED.base_url,
  enabled = true;
