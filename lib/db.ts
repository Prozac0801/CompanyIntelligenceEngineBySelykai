import { neon } from "@neondatabase/serverless";

export interface DatabaseHealth {
  configured: boolean;
  reachable: boolean;
  schemaReady: boolean;
  latencyMs?: number;
  errorCode?: "database_unreachable";
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured. The engine can still run in read-only live-source mode.");
  }
  return neon(url);
}

export async function checkDatabase(): Promise<DatabaseHealth> {
  if (!hasDatabase()) {
    return { configured: false, reachable: false, schemaReady: false };
  }

  const startedAt = Date.now();
  try {
    const sql = sqlClient();
    const rows = await sql`
      SELECT to_regclass('public.companies')::text AS companies_table
    `;

    return {
      configured: true,
      reachable: true,
      schemaReady: Boolean(rows[0]?.companies_table),
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      schemaReady: false,
      latencyMs: Date.now() - startedAt,
      errorCode: "database_unreachable",
    };
  }
}
