import { hasDatabase, sqlClient } from "@/lib/db";

export async function readProviderCache<T>(cacheKey: string): Promise<T | null> {
  if (!hasDatabase()) return null;

  try {
    const sql = sqlClient();
    const rows = (await sql`
      SELECT payload
      FROM api_cache
      WHERE cache_key = ${cacheKey} AND expires_at > now()
      LIMIT 1
    `) as unknown as Array<{ payload: T }>;
    return rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}

export async function writeProviderCache(
  providerId: string,
  cacheKey: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!hasDatabase()) return;

  try {
    const sql = sqlClient();
    const safeTtl = Math.max(60, Math.min(ttlSeconds, 60 * 60 * 24 * 90));
    await sql`
      INSERT INTO api_cache (cache_key, provider_id, payload, expires_at, created_at)
      VALUES (
        ${cacheKey}, ${providerId}, ${JSON.stringify(payload)}::jsonb,
        now() + (${safeTtl} * interval '1 second'), now()
      )
      ON CONFLICT (cache_key) DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        payload = EXCLUDED.payload,
        expires_at = EXCLUDED.expires_at,
        created_at = now()
    `;
  } catch (error) {
    console.warn(
      "Unable to persist provider cache.",
      error instanceof Error ? error.message : "unknown_error",
    );
  }
}
