import { hasDatabase } from "@/lib/db";
import {
  getCompanyBySiren,
  getInpiRneFacts,
  isInpiRneConfigured,
} from "@/lib/providers";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";
import { detectCompanyEvents } from "@/lib/intelligence/events";
import { factMap, factsFromCompany } from "@/lib/intelligence/facts";
import { inferSignals } from "@/lib/intelligence/signals";
import { loadLatestFacts, persistCompanyAnalysis } from "@/lib/persistence/company-repository";
import type { CompanyProfile } from "@/types/company";
import type { CompanyAnalysisResult, CompanyFact } from "@/types/intelligence";

export const ENGINE_VERSION = "0.2.0";

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

  const facts = [...factsFromCompany(company), ...(await supplementalFacts(siren))];
  const databaseConfigured = hasDatabase();
  const previousFacts = databaseConfigured ? await loadLatestFacts(siren) : new Map();
  const events = detectCompanyEvents(previousFacts, factMap(facts));
  const signals = inferSignals(events);
  const score = computeOpportunityScore(company);
  let persisted = false;

  if (databaseConfigured && options.persist !== false) {
    persisted = await persistCompanyAnalysis({ company, facts, events, signals, score });
  }

  return {
    company,
    facts,
    events,
    signals,
    score,
    meta: {
      persisted,
      databaseConfigured,
      engineVersion: ENGINE_VERSION,
      analyzedAt: new Date().toISOString(),
    },
  };
}
