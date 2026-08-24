import { hasDatabase } from "@/lib/db";
import {
  commercialReuseDecision,
  getBodaccEvents,
  getCachedInpiRneSupplement,
  getCompanyBySiren,
  isInpiRneConfigured,
} from "@/lib/providers";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";
import { buildBusinessTriggers } from "@/lib/intelligence/business-triggers";
import {
  applyCommercialActionPolicyToScore,
  applyCommercialActionPolicyToSummary,
} from "@/lib/intelligence/commercial-policy";
import { detectCompanyEvents } from "@/lib/intelligence/events";
import { executionPolicy, type AnalysisIntent } from "@/lib/intelligence/execution-policy";
import { factMap, factsFromCompany } from "@/lib/intelligence/facts";
import { enrichCompany, factsFromEnrichment } from "@/lib/intelligence/enrichment";
import { inferSignals } from "@/lib/intelligence/signals";
import { buildCompanyIntelligenceSummary } from "@/lib/intelligence/summary";
import { loadOpportunityBenchmark } from "@/lib/persistence/benchmark-repository";
import { loadLatestFacts, persistCompanyAnalysis } from "@/lib/persistence/company-repository";
import { canWriteRuntimeState } from "@/lib/runtime/write-policy";
import type { CompanyEstablishment, CompanyProfile } from "@/types/company";
import type { CompanyAnalysisResult, CompanyFact } from "@/types/intelligence";

export const ENGINE_VERSION = "0.5.10";

interface RneSupplement {
  facts: CompanyFact[];
  establishments: CompanyEstablishment[];
}

export interface AnalyzeCompanyOptions {
  persist?: boolean;
  intent?: AnalysisIntent;
}

async function supplementalRne(siren: string): Promise<RneSupplement> {
  if (!isInpiRneConfigured()) return { facts: [], establishments: [] };

  try {
    const supplement = await getCachedInpiRneSupplement(siren);
    return { facts: supplement.facts, establishments: supplement.establishments };
  } catch (error) {
    console.warn(
      "INPI RNE supplemental provider unavailable; continuing with primary source.",
      error instanceof Error ? error.message : "unknown_error",
    );
    return { facts: [], establishments: [] };
  }
}

function establishmentKey(item: CompanyEstablishment): string {
  if (item.siret) return `siret:${item.siret}`;
  return `address:${[item.address, item.postalCode, item.city].filter(Boolean).join("|").toLocaleLowerCase("fr-FR")}`;
}

export function mergeCompanyEstablishments(
  primary: CompanyEstablishment[],
  rne: CompanyEstablishment[],
): CompanyEstablishment[] {
  const merged = new Map<string, CompanyEstablishment>();

  for (const item of [...rne, ...primary]) {
    const key = establishmentKey(item);
    if (key === "address:") continue;
    const current = merged.get(key);
    merged.set(key, current ? {
      ...current,
      ...Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)),
      headOffice: Boolean(current.headOffice || item.headOffice),
      active: item.active ?? current.active,
    } : item);
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.headOffice !== b.headOffice) return a.headOffice ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.city || a.address || a.siret || "").localeCompare(b.city || b.address || b.siret || "", "fr");
  });
}

export async function analyzeCompany(
  siren: string,
  options: AnalyzeCompanyOptions = {},
): Promise<CompanyAnalysisResult<CompanyProfile> | null> {
  const policy = executionPolicy(options.intent || "interactive");
  const primaryCompany = await getCompanyBySiren(siren);
  if (!primaryCompany) return null;

  const databaseConfigured = hasDatabase();
  const previousFactsPromise: Promise<Map<string, CompanyFact>> = databaseConfigured
    ? loadLatestFacts(siren)
    : Promise.resolve(new Map<string, CompanyFact>());
  const [rne, baseEnrichment, bodacc, previousFacts] = await Promise.all([
    supplementalRne(siren),
    enrichCompany(primaryCompany),
    getBodaccEvents(siren, 30),
    previousFactsPromise,
  ]);

  const company: CompanyProfile = {
    ...primaryCompany,
    establishments: mergeCompanyEstablishments(primaryCompany.establishments, rne.establishments),
  };

  const enrichment = {
    ...baseEnrichment,
    legalEvents: bodacc.events,
    evidence: bodacc.evidence
      ? [...baseEnrichment.evidence, bodacc.evidence]
      : baseEnrichment.evidence,
  };

  const facts = [
    ...factsFromCompany(company),
    ...rne.facts,
    ...factsFromEnrichment(enrichment),
  ];
  const commercialAction = commercialReuseDecision(facts);
  const triggers = buildBusinessTriggers({ company, enrichment, facts });
  const events = policy.detectEvents ? detectCompanyEvents(previousFacts, factMap(facts)) : [];
  const signals = inferSignals(events);
  const rawScore = computeOpportunityScore({ company, facts, events, signals, enrichment, triggers });
  const score = applyCommercialActionPolicyToScore(rawScore, commercialAction);

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

  const rawSummary = buildCompanyIntelligenceSummary({
    company,
    enrichment,
    score,
    signals,
    businessTriggers: triggers,
  });
  const summary = applyCommercialActionPolicyToSummary(rawSummary, commercialAction);
  const shouldPersist = options.persist ?? (policy.persistAnalysis && canWriteRuntimeState());

  let persisted = false;
  if (databaseConfigured && shouldPersist && canWriteRuntimeState()) {
    persisted = await persistCompanyAnalysis({ company, enrichment, facts, events, signals, score });
  }

  return {
    company,
    enrichment,
    facts,
    events,
    signals,
    triggers,
    commercialAction,
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
