import { hasDatabase, sqlClient } from "@/lib/db";

export interface OpportunityBenchmark {
  percentile: number;
  sampleSize: number;
  scope: string;
}

export async function loadOpportunityBenchmark(input: {
  nafCode?: string;
  scoreVersion: string;
  currentScore: number;
  minimumSample?: number;
}): Promise<OpportunityBenchmark | null> {
  if (!hasDatabase() || !input.nafCode) return null;
  const division = input.nafCode.slice(0, 2);
  if (division.length < 2) return null;

  try {
    const sql = sqlClient();
    const rows = (await sql`
      WITH latest_scores AS (
        SELECT DISTINCT ON (cs.company_id)
          cs.company_id,
          cs.value,
          c.naf_code
        FROM company_scores cs
        JOIN companies c ON c.id = cs.company_id
        WHERE cs.score_version = ${input.scoreVersion}
          AND c.naf_code IS NOT NULL
          AND left(c.naf_code, 2) = ${division}
        ORDER BY cs.company_id, cs.computed_at DESC
      )
      SELECT
        count(*)::int AS sample_size,
        CASE WHEN count(*) = 0 THEN 0
          ELSE round(100.0 * count(*) FILTER (WHERE value <= ${input.currentScore}) / count(*))::int
        END AS percentile
      FROM latest_scores
    `) as unknown as Array<{ sample_size: number; percentile: number }>;

    const sampleSize = Number(rows[0]?.sample_size || 0);
    const minimumSample = Math.max(10, input.minimumSample || 20);
    if (sampleSize < minimumSample) return null;

    return {
      percentile: Math.max(0, Math.min(100, Number(rows[0]?.percentile || 0))),
      sampleSize,
      scope: `division NAF ${division}`,
    };
  } catch {
    return null;
  }
}
