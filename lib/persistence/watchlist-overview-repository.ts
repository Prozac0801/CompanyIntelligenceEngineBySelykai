import { hasDatabase, sqlClient } from "@/lib/db";

function requireDatabase() {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required for watchlist overview operations.");
  return sqlClient();
}

export async function getWatchlistCompanyCounts(input: {
  userId: string;
  workspaceId: string;
}): Promise<Map<string, number>> {
  const sql = requireDatabase();
  const rows = (await sql`
    SELECT wl.id AS watchlist_id, count(wc.company_id)::int AS company_count
    FROM watchlists wl
    JOIN workspace_members wm
      ON wm.workspace_id = wl.workspace_id
      AND wm.user_id = ${input.userId}
    LEFT JOIN watchlist_companies wc
      ON wc.watchlist_id = wl.id
      AND wc.is_active = true
    WHERE wl.workspace_id = ${input.workspaceId}
    GROUP BY wl.id
  `) as unknown as Array<{ watchlist_id: string; company_count: number }>;

  return new Map(rows.map((row) => [row.watchlist_id, row.company_count]));
}
