import { hasDatabase, sqlClient } from "@/lib/db";
import { canWriteRuntimeState } from "@/lib/runtime/write-policy";
import type { IntelligenceAlert } from "@/types/workspace";

function requireDatabase() {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required for alert operations.");
  return sqlClient();
}

function requireWritableDatabase() {
  if (!canWriteRuntimeState()) {
    throw new Error("Preview deployments are read-only for alert operations.");
  }
  return requireDatabase();
}

function iso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

export async function listWorkspaceInboxAlerts(input: {
  userId: string;
  workspaceId: string;
  limit?: number;
}): Promise<IntelligenceAlert[]> {
  const sql = requireDatabase();
  const safeLimit = Math.max(1, Math.min(input.limit || 20, 100));
  const rows = (await sql`
    SELECT
      a.id, a.workspace_id, a.watchlist_id, a.company_id, c.siren,
      c.display_name, c.legal_name, a.alert_type, a.severity, a.title,
      a.body, a.status, a.created_at, a.read_at
    FROM alerts a
    JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ${input.userId}
    JOIN companies c ON c.id = a.company_id
    WHERE a.workspace_id = ${input.workspaceId}
      AND a.status <> 'archived'
    ORDER BY
      CASE WHEN a.status = 'unread' THEN 0 ELSE 1 END,
      a.created_at DESC
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
    severity: IntelligenceAlert["severity"];
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

export async function countUnreadWorkspaceAlerts(input: {
  userId: string;
  workspaceId: string;
}): Promise<number> {
  const sql = requireDatabase();
  const rows = (await sql`
    SELECT count(*)::int AS count
    FROM alerts a
    WHERE a.workspace_id = ${input.workspaceId}
      AND a.status = 'unread'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = a.workspace_id AND wm.user_id = ${input.userId}
      )
  `) as unknown as Array<{ count: number }>;
  return rows[0]?.count || 0;
}

export async function markAlertRead(input: {
  userId: string;
  alertId: string;
}): Promise<boolean> {
  const sql = requireWritableDatabase();
  const rows = (await sql`
    UPDATE alerts a
    SET status = 'read', read_at = COALESCE(a.read_at, now())
    WHERE a.id = ${input.alertId}::uuid
      AND a.status = 'unread'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = a.workspace_id AND wm.user_id = ${input.userId}
      )
    RETURNING a.id
  `) as unknown as Array<{ id: string }>;
  return Boolean(rows[0]);
}

export async function archiveAlert(input: {
  userId: string;
  alertId: string;
}): Promise<boolean> {
  const sql = requireWritableDatabase();
  const rows = (await sql`
    UPDATE alerts a
    SET status = 'archived', read_at = COALESCE(a.read_at, now())
    WHERE a.id = ${input.alertId}::uuid
      AND a.status <> 'archived'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = a.workspace_id AND wm.user_id = ${input.userId}
      )
    RETURNING a.id
  `) as unknown as Array<{ id: string }>;
  return Boolean(rows[0]);
}

export async function markAllWorkspaceAlertsRead(input: {
  userId: string;
  workspaceId: string;
}): Promise<number> {
  const sql = requireWritableDatabase();
  const rows = (await sql`
    UPDATE alerts a
    SET status = 'read', read_at = COALESCE(a.read_at, now())
    WHERE a.workspace_id = ${input.workspaceId}
      AND a.status = 'unread'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = a.workspace_id AND wm.user_id = ${input.userId}
      )
    RETURNING a.id
  `) as unknown as Array<{ id: string }>;
  return rows.length;
}
