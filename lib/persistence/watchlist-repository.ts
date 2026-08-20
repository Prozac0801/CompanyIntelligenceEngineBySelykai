import { hasDatabase, sqlClient } from "@/lib/db";
import type {
  AlertSeverity,
  IntelligenceAlert,
  MonitorFrequency,
  MonitoringTarget,
  Watchlist,
  WatchlistCompany,
  Workspace,
} from "@/types/workspace";

function requireDatabase() {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required for workspace operations.");
  return sqlClient();
}

function iso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

export async function createWorkspaceForUser(input: {
  userId: string;
  name: string;
  slug: string;
}): Promise<Workspace> {
  const sql = requireDatabase();
  const rows = (await sql`
    WITH new_workspace AS (
      INSERT INTO workspaces (name, slug, created_by_user_id, created_at, updated_at)
      VALUES (${input.name}, ${input.slug}, ${input.userId}, now(), now())
      RETURNING id, name, slug, created_at, updated_at
    ), new_member AS (
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      SELECT id, ${input.userId}, 'owner', now()
      FROM new_workspace
      RETURNING workspace_id
    )
    SELECT nw.id, nw.name, nw.slug, nw.created_at, nw.updated_at, 'owner'::text AS role
    FROM new_workspace nw
    JOIN new_member nm ON nm.workspace_id = nw.id
  `) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string | Date;
    updated_at: string | Date;
    role: Workspace["role"];
  }>;

  const row = rows[0];
  if (!row) throw new Error("Unable to create workspace.");
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listUserWorkspaces(userId: string): Promise<Workspace[]> {
  const sql = requireDatabase();
  const rows = (await sql`
    SELECT w.id, w.name, w.slug, w.created_at, w.updated_at, wm.role
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = ${userId}
    ORDER BY w.updated_at DESC
  `) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string | Date;
    updated_at: string | Date;
    role: Workspace["role"];
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function createWatchlist(input: {
  userId: string;
  workspaceId: string;
  name: string;
  description?: string;
}): Promise<Watchlist> {
  const sql = requireDatabase();
  const rows = (await sql`
    INSERT INTO watchlists (workspace_id, name, description, created_by_user_id, created_at, updated_at)
    SELECT ${input.workspaceId}, ${input.name}, ${input.description || null}, ${input.userId}, now(), now()
    WHERE EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = ${input.workspaceId} AND user_id = ${input.userId}
    )
    RETURNING id, workspace_id, name, description, created_at, updated_at
  `) as unknown as Array<{
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    created_at: string | Date;
    updated_at: string | Date;
  }>;

  const row = rows[0];
  if (!row) throw new Error("Workspace access denied or watchlist could not be created.");
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listWatchlists(userId: string, workspaceId: string): Promise<Watchlist[]> {
  const sql = requireDatabase();
  const rows = (await sql`
    SELECT wl.id, wl.workspace_id, wl.name, wl.description, wl.created_at, wl.updated_at
    FROM watchlists wl
    JOIN workspace_members wm ON wm.workspace_id = wl.workspace_id
    WHERE wl.workspace_id = ${workspaceId} AND wm.user_id = ${userId}
    ORDER BY wl.updated_at DESC
  `) as unknown as Array<{
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    created_at: string | Date;
    updated_at: string | Date;
  }>;

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function addCompanyToWatchlist(input: {
  userId: string;
  watchlistId: string;
  siren: string;
  frequency?: MonitorFrequency;
  notes?: string;
}): Promise<boolean> {
  const sql = requireDatabase();
  const frequency = input.frequency || "daily";
  const rows = (await sql`
    INSERT INTO watchlist_companies (
      watchlist_id, company_id, added_by_user_id, monitor_frequency,
      is_active, added_at, next_check_at, notes
    )
    SELECT
      wl.id, c.id, ${input.userId}, ${frequency}, true, now(),
      CASE WHEN ${frequency} = 'manual' THEN NULL ELSE now() END,
      ${input.notes || null}
    FROM watchlists wl
    JOIN workspace_members wm ON wm.workspace_id = wl.workspace_id AND wm.user_id = ${input.userId}
    JOIN companies c ON c.siren = ${input.siren}
    WHERE wl.id = ${input.watchlistId}
    ON CONFLICT (watchlist_id, company_id) DO UPDATE SET
      monitor_frequency = EXCLUDED.monitor_frequency,
      is_active = true,
      notes = COALESCE(EXCLUDED.notes, watchlist_companies.notes),
      next_check_at = CASE
        WHEN EXCLUDED.monitor_frequency = 'manual' THEN NULL
        ELSE COALESCE(watchlist_companies.next_check_at, now())
      END
    RETURNING watchlist_id
  `) as unknown as Array<{ watchlist_id: string }>;

  return Boolean(rows[0]);
}

export async function listWatchlistCompanies(
  userId: string,
  watchlistId: string,
): Promise<WatchlistCompany[]> {
  const sql = requireDatabase();
  const rows = (await sql`
    SELECT
      wc.watchlist_id, wc.company_id, c.siren, c.display_name, c.legal_name,
      wc.monitor_frequency, wc.is_active, wc.added_at, wc.last_checked_at,
      wc.next_check_at, wc.notes
    FROM watchlist_companies wc
    JOIN watchlists wl ON wl.id = wc.watchlist_id
    JOIN workspace_members wm ON wm.workspace_id = wl.workspace_id AND wm.user_id = ${userId}
    JOIN companies c ON c.id = wc.company_id
    WHERE wc.watchlist_id = ${watchlistId}
    ORDER BY wc.added_at DESC
  `) as unknown as Array<{
    watchlist_id: string;
    company_id: string;
    siren: string;
    display_name: string | null;
    legal_name: string;
    monitor_frequency: MonitorFrequency;
    is_active: boolean;
    added_at: string | Date;
    last_checked_at: string | Date | null;
    next_check_at: string | Date | null;
    notes: string | null;
  }>;

  return rows.map((row) => ({
    watchlistId: row.watchlist_id,
    companyId: row.company_id,
    siren: row.siren,
    name: row.display_name || row.legal_name,
    monitorFrequency: row.monitor_frequency,
    isActive: row.is_active,
    addedAt: new Date(row.added_at).toISOString(),
    lastCheckedAt: iso(row.last_checked_at),
    nextCheckAt: iso(row.next_check_at),
    notes: row.notes || undefined,
  }));
}

export async function listDueMonitoringTargets(limit = 20): Promise<MonitoringTarget[]> {
  const sql = requireDatabase();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const rows = (await sql`
    SELECT
      wc.watchlist_id, wl.workspace_id, wc.company_id, c.siren, wc.monitor_frequency
    FROM watchlist_companies wc
    JOIN watchlists wl ON wl.id = wc.watchlist_id
    JOIN companies c ON c.id = wc.company_id
    WHERE wc.is_active = true
      AND wc.monitor_frequency <> 'manual'
      AND (wc.next_check_at IS NULL OR wc.next_check_at <= now())
    ORDER BY COALESCE(wc.next_check_at, wc.added_at) ASC
    LIMIT ${safeLimit}
  `) as unknown as Array<{
    watchlist_id: string;
    workspace_id: string;
    company_id: string;
    siren: string;
    monitor_frequency: MonitorFrequency;
  }>;

  return rows.map((row) => ({
    watchlistId: row.watchlist_id,
    workspaceId: row.workspace_id,
    companyId: row.company_id,
    siren: row.siren,
    monitorFrequency: row.monitor_frequency,
  }));
}

export async function markMonitoringTargetChecked(target: MonitoringTarget): Promise<void> {
  const sql = requireDatabase();
  await sql`
    UPDATE watchlist_companies
    SET
      last_checked_at = now(),
      next_check_at = CASE
        WHEN monitor_frequency = 'daily' THEN now() + interval '1 day'
        WHEN monitor_frequency = 'weekly' THEN now() + interval '7 days'
        ELSE NULL
      END
    WHERE watchlist_id = ${target.watchlistId} AND company_id = ${target.companyId}
  `;
}

export async function createIntelligenceAlert(input: {
  workspaceId: string;
  watchlistId: string;
  companyId: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  body?: string;
  dedupeKey: string;
}): Promise<boolean> {
  const sql = requireDatabase();
  const rows = (await sql`
    INSERT INTO alerts (
      workspace_id, watchlist_id, company_id, alert_type, severity,
      title, body, dedupe_key, status, created_at
    ) VALUES (
      ${input.workspaceId}, ${input.watchlistId}, ${input.companyId}, ${input.type},
      ${input.severity}, ${input.title}, ${input.body || null}, ${input.dedupeKey}, 'unread', now()
    )
    ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  return Boolean(rows[0]);
}

export async function listWorkspaceAlerts(input: {
  userId: string;
  workspaceId: string;
  limit?: number;
}): Promise<IntelligenceAlert[]> {
  const sql = requireDatabase();
  const safeLimit = Math.max(1, Math.min(input.limit || 50, 100));
  const rows = (await sql`
    SELECT
      a.id, a.workspace_id, a.watchlist_id, a.company_id, c.siren,
      c.display_name, c.legal_name, a.alert_type, a.severity, a.title,
      a.body, a.status, a.created_at, a.read_at
    FROM alerts a
    JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ${input.userId}
    JOIN companies c ON c.id = a.company_id
    WHERE a.workspace_id = ${input.workspaceId}
    ORDER BY a.created_at DESC
    LIMIT ${safeLimit}
  `) as unknown as Array<{
    id: string;
    workspace_id: string;
    watchlist_id: string | null;
    company_id: string;
    siren: string;
    display_name: string | null;
    legal_name: string;
    alert_type: string;
    severity: AlertSeverity;
    title: string;
    body: string | null;
    status: IntelligenceAlert["status"];
    created_at: string | Date;
    read_at: string | Date | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    watchlistId: row.watchlist_id || undefined,
    companyId: row.company_id,
    siren: row.siren,
    companyName: row.display_name || row.legal_name,
    type: row.alert_type,
    severity: row.severity,
    title: row.title,
    body: row.body || undefined,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    readAt: iso(row.read_at),
  }));
}
