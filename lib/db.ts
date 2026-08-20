import { neon } from "@neondatabase/serverless";

export type DatabaseConnectionSource =
  | "DATABASE_URL"
  | "POSTGRES_URL"
  | "POSTGRES_PRISMA_URL"
  | "POSTGRES_URL_NON_POOLING"
  | "DATABASE_URL_UNPOOLED";

export interface DatabaseHealth {
  configured: boolean;
  reachable: boolean;
  schemaReady: boolean;
  connectionSource?: DatabaseConnectionSource;
  latencyMs?: number;
  errorCode?: "database_unreachable";
}

const DATABASE_ENV_CANDIDATES: readonly DatabaseConnectionSource[] = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

export function databaseConnection(): {
  url?: string;
  source?: DatabaseConnectionSource;
} {
  for (const source of DATABASE_ENV_CANDIDATES) {
    const value = process.env[source]?.trim();
    if (value) return { url: value, source };
  }
  return {};
}

export function hasDatabase(): boolean {
  return Boolean(databaseConnection().url);
}

export function sqlClient() {
  const { url } = databaseConnection();
  if (!url) {
    throw new Error(
      "No supported database connection variable is configured. The engine can still run in read-only live-source mode.",
    );
  }
  return neon(url);
}

export async function checkDatabase(): Promise<DatabaseHealth> {
  const connection = databaseConnection();
  if (!connection.url) {
    return { configured: false, reachable: false, schemaReady: false };
  }

  const startedAt = Date.now();
  try {
    const sql = neon(connection.url);
    const rows = await sql`
      SELECT to_regclass('public.companies')::text AS companies_table
    `;

    return {
      configured: true,
      reachable: true,
      schemaReady: Boolean(rows[0]?.companies_table),
      connectionSource: connection.source,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      schemaReady: false,
      connectionSource: connection.source,
      latencyMs: Date.now() - startedAt,
      errorCode: "database_unreachable",
    };
  }
}
