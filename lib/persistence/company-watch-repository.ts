import { hasDatabase, sqlClient } from "@/lib/db";
import type { MonitorFrequency } from "@/types/workspace";

export interface CompanyWatchMembership {
  watchlistId: string;
  monitorFrequency: MonitorFrequency;
}

export async function listCompanyWatchMemberships(input: {
  userId: string;
  workspaceId: string;
  siren: string;
}): Promise<CompanyWatchMembership[]> {
  if (!hasDatabase()) return [];
  const sql = sqlClient();
  const rows = (await sql`
    SELECT wc.watchlist_id, wc.monitor_frequency
    FROM watchlist_companies wc
    JOIN watchlists wl ON wl.id = wc.watchlist_id
    JOIN workspace_members wm
      ON wm.workspace_id = wl.workspace_id
     AND wm.user_id = ${input.userId}
    JOIN companies c ON c.id = wc.company_id
    WHERE wl.workspace_id = ${input.workspaceId}
      AND c.siren = ${input.siren}
      AND wc.is_active = true
    ORDER BY wc.added_at ASC
  `) as unknown as Array<{
    watchlist_id: string;
    monitor_frequency: MonitorFrequency;
  }>;

  return rows.map((row) => ({
    watchlistId: row.watchlist_id,
    monitorFrequency: row.monitor_frequency,
  }));
}
