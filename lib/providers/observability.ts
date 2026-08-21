import { hasDatabase, sqlClient } from "@/lib/db";
import { canWriteRuntimeState } from "@/lib/runtime/write-policy";

export type ProviderRunStatus =
  | "success"
  | "not_found"
  | "rate_limited"
  | "auth_error"
  | "upstream_error"
  | "network_error";

export interface ProviderRunInput {
  providerId: string;
  operation: string;
  status: ProviderRunStatus;
  httpStatus?: number;
  latencyMs: number;
  estimatedCostEur?: number;
}

export async function recordProviderRun(input: ProviderRunInput): Promise<void> {
  if (!hasDatabase() || !canWriteRuntimeState()) return;

  try {
    const sql = sqlClient();
    await sql`
      INSERT INTO provider_runs (
        provider_id, operation, status, http_status, latency_ms,
        estimated_cost_eur, started_at, completed_at
      ) VALUES (
        ${input.providerId}, ${input.operation}, ${input.status}, ${input.httpStatus ?? null},
        ${Math.max(0, Math.round(input.latencyMs))}, ${input.estimatedCostEur ?? 0},
        now() - (${Math.max(0, Math.round(input.latencyMs))} * interval '1 millisecond'), now()
      )
    `;
  } catch (error) {
    console.warn(
      "Unable to persist provider observability record.",
      error instanceof Error ? error.message : "unknown_error",
    );
  }
}

export function providerStatusFromHttp(status: number): ProviderRunStatus {
  if (status >= 200 && status < 300) return "success";
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "upstream_error";
}
