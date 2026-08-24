import { hasDatabase } from "@/lib/db";
import { factsFromCompany } from "@/lib/intelligence/facts";
import { mergeWebIntelligence } from "@/lib/intelligence/enrichment";
import { loadPersistedContactContext } from "@/lib/persistence/company-context-repository";
import {
  commercialReuseDecision,
  getCompanyBySiren,
  getHunterCompanyIntelligence,
  getInpiRneSupplement,
  getSerpWebIntelligence,
  isInpiRneConfigured,
  resolveHunterDomain,
} from "@/lib/providers";
import { verifyCompanyWebsite } from "@/lib/providers/direct-web";
import type { CommercialActionPolicy } from "@/types/intelligence";

export interface ContactEligibility {
  policy: CommercialActionPolicy;
  domain?: string;
  source: "persisted" | "live";
}

const POLICY_FRESH_MS = 24 * 60 * 60 * 1000;
const DOMAIN_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

type WebsiteVerificationResult = Awaited<ReturnType<typeof verifyCompanyWebsite>>;

function isFresh(iso: string | undefined, maxAgeMs: number, now = Date.now()): boolean {
  if (!iso) return false;
  const value = Date.parse(iso);
  return Number.isFinite(value) && now - value >= 0 && now - value <= maxAgeMs;
}

async function persistedEligibility(siren: string): Promise<ContactEligibility | null> {
  if (!hasDatabase()) return null;
  const context = await loadPersistedContactContext(siren);
  if (!context) return null;
  const policyFact = context.facts.find((fact) => fact.key === "commercial_prospecting_allowed");
  if (!policyFact || !isFresh(policyFact.evidence.observedAt, POLICY_FRESH_MS)) return null;

  const policy = commercialReuseDecision(context.facts);
  if (policy.status !== "allowed") return { policy, source: "persisted" };
  if (context.domain && isFresh(context.companyUpdatedAt, DOMAIN_FRESH_MS)) {
    return { policy, domain: context.domain, source: "persisted" };
  }
  return null;
}

async function liveEligibility(siren: string): Promise<ContactEligibility | null> {
  const company = await getCompanyBySiren(siren);
  if (!company) return null;

  let rneFacts = [] as Awaited<ReturnType<typeof getInpiRneSupplement>>["facts"];
  if (isInpiRneConfigured()) {
    try {
      rneFacts = (await getInpiRneSupplement(siren)).facts;
    } catch {
      rneFacts = [];
    }
  }
  const policy = commercialReuseDecision([...factsFromCompany(company), ...rneFacts]);
  if (policy.status !== "allowed") return { policy, source: "live" };

  const hunterDomain = await resolveHunterDomain(company.name);
  const emptyVerification = {} as WebsiteVerificationResult;
  const [initialHunter, serp, initialFirstParty] = await Promise.all([
    hunterDomain ? getHunterCompanyIntelligence(hunterDomain) : Promise.resolve(null),
    getSerpWebIntelligence(company.name, hunterDomain),
    hunterDomain ? verifyCompanyWebsite(company.name, hunterDomain) : Promise.resolve(emptyVerification),
  ]);

  const fallbackDomain = hunterDomain || serp.web?.domain;
  const hunter = initialHunter || (fallbackDomain ? await getHunterCompanyIntelligence(fallbackDomain) : null);
  const firstParty: WebsiteVerificationResult = initialFirstParty.web || initialFirstParty.evidence || !fallbackDomain
    ? initialFirstParty
    : await verifyCompanyWebsite(company.name, fallbackDomain);
  const web = mergeWebIntelligence(hunter?.web, serp.web, firstParty.web);
  const domain = web?.domainVerified ? web.domain : undefined;
  return { policy, domain, source: "live" };
}

export async function resolveContactEligibility(siren: string): Promise<ContactEligibility | null> {
  const persisted = await persistedEligibility(siren);
  if (persisted) return persisted;
  return liveEligibility(siren);
}
