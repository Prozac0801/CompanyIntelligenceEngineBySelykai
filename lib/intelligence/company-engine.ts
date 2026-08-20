import { hasDatabase } from "@/lib/db";
import {
  getBodaccEvents,
  getCompanyBySiren,
  getInpiRneFacts,
  isInpiRneConfigured,
} from "@/lib/providers";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";
import { detectCompanyEvents } from "@/lib/intelligence/events";
import { factMap, factsFromCompany } from "@/lib/intelligence/facts";
import { enrichCompany, factsFromEnrichment } from "@/lib/intelligence/enrichment";
import { inferSignals } from "@/lib/intelligence/signals";
import { buildCompanyIntelligenceSummary } from "@/lib/intelligence/summary";
import { loadOpportunityBenchmark } from "@/lib/persistence/benchmark-repository";
import { loadLatestFacts, persistCompanyAnalysis } from "@/lib/persistence/company-repository";
import type { CompanyProfile } from "@/types/company";
import type { CompanyAnalysisResult, CompanyFact } from "@/types/intelligence";

export const ENGINE_VERSION = "0.4.0";

async function supplementalFacts(siren: string): Promise<CompanyFact[]> {
  if (!isInpiRneConfigured()) return [];

  try {
    return await getInpiRneFacts(siren);
  } catch (error) {
    console.warn(
      "INPI RNE supplemental provider unavailable; continuing with primary source.",
      error instanceof Error ? error.message : "unknown_error",
    );
    return [];
  }
}

export async function analyzeCompany(
  siren: string,
  options: { persist?: boolean } = {},
): Promise<CompanyAnalysisResult<CompanyProfile> | null> {
  const company = await getCompanyBySiren(siren);
  if (!company) return null;

  const [rneFacts, baseEnrichment, bodacc] = await Promise.all([
    supplementalFacts(siren),
    enrichCompany(company),
    getBodaccEvents(siren, 30),
  ]);

  const enrichment = {
    ...baseEnrichment,
    legalEvents: bodacc.events,
    evidence: bodacc.evidence
      ? [...baseEnrichment.evidence, bodacc.evidence]
      : baseEnrichment.evidence,
  };

  const facts = [
    ...factsFromCompany(company),
    ...rneFacts,
    ...factsFromEnrichment(enrichment),
  ];
  const databaseConfigured = hasDatabase();
  const previousFacts = databaseConfigured ? await loadLatestFacts(siren) : new Map();
  const events = detectCompanyEvents(previousFacts, factMap(facts));
  const signals = inferSignals(events);
  const score = computeOpportunityScore({ company, facts, events, signals, enrichment });

  if (databaseConfigured) {
    const benchmark = await loadOpportunityBenchmark({
      nafCode: company.nafCode,
      scoreVersion: score.version,
      currentScore: score.value,
    });
    if (benchmark) {
      score.basis.benchmarkStatus = "available";
      score.basis.benchmarkPercentile = benchmark.percentile;
      score.basis.benchmarkSampleSize = benchmark.sampleSize;
      score.basis.benchmarkScope = benchmark.scope;
      score.basis.benchmarkDescription = `Percentile ${benchmark.percentile} sur ${benchmark.sampleSize} entreprises comparables (${benchmark.scope}).`;
    }
  }

  const summary = buildCompanyIntelligenceSummary({ company, enrichment, score, signals });
  const shouldPersist = options.persist ?? process.env.VERCEL_ENV !== "preview";

  let persisted = false;
  if (databaseConfigured && shouldPersist) {
    persisted = await persistCompanyAnalysis({ company, enrichment, facts, events, signals, score });
  }

  return {
    company,
    enrichment,
    facts,
    events,
    signals,
    score,
    summary,
    meta: {
      persisted,
      databaseConfigured,
      engineVersion: ENGINE_VERSION,
      analyzedAt: new Date().toISOString(),
    },
  };
}
