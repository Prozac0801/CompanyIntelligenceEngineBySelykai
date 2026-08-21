import type {
  CompanyEnrichment,
  CompanyProfile,
  CompanyWebIntelligence,
  SourceEvidence,
} from "@/types/company";
import type { CompanyFact } from "@/types/intelligence";
import {
  getCompanyNews,
  getSerpWebIntelligence,
} from "@/lib/providers/apilayer";
import {
  getHunterCompanyIntelligence,
  resolveHunterDomain,
} from "@/lib/providers/hunter";
import { createFact } from "./facts";

function mergeUnique(...values: Array<string[] | undefined>): string[] {
  return Array.from(new Set(values.flatMap((items) => items || []).filter(Boolean)));
}

function cleanDomain(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLocaleLowerCase("fr-FR");
  } catch {
    return value.replace(/^www\./, "").toLocaleLowerCase("fr-FR");
  }
}

function cleanSocialHandle(value?: string): string | undefined {
  const normalized = value?.replace(/^https?:\/\/(www\.)?linkedin\.com\//i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return normalized || undefined;
}

export function mergeWebIntelligence(
  hunter?: CompanyWebIntelligence,
  serp?: Partial<CompanyWebIntelligence>,
): CompanyWebIntelligence | undefined {
  if (!hunter && !serp) return undefined;

  const hunterDomain = cleanDomain(hunter?.domain || hunter?.websiteUrl);
  const serpDomain = cleanDomain(serp?.domain || serp?.websiteUrl);
  const domainVerified = Boolean(hunterDomain && serpDomain && hunterDomain === serpDomain);
  const domain = hunterDomain || serpDomain;

  const hunterLinkedin = cleanSocialHandle(hunter?.linkedinHandle);
  const serpLinkedin = cleanSocialHandle(serp?.linkedinHandle);
  const linkedinVerified = Boolean(hunterLinkedin && serpLinkedin && hunterLinkedin === serpLinkedin);

  const canUseSerpCopy = Boolean(serp?.serpSnippet && serpDomain && (!hunterDomain || domainVerified));
  const description = canUseSerpCopy ? serp?.serpSnippet : undefined;

  return {
    domain,
    websiteUrl: domainVerified
      ? serp?.websiteUrl || hunter?.websiteUrl
      : serpDomain && !hunterDomain
        ? serp?.websiteUrl
        : hunter?.websiteUrl,
    description,
    industry: domainVerified ? hunter?.industry : undefined,
    sector: domainVerified ? hunter?.sector : undefined,
    employeeEstimate: domainVerified ? hunter?.employeeEstimate : undefined,
    trafficRank: domainVerified ? hunter?.trafficRank : undefined,
    technologies: domainVerified ? mergeUnique(hunter?.technologies) : [],
    phoneNumbers: domainVerified ? mergeUnique(hunter?.phoneNumbers) : [],
    genericEmails: domainVerified ? mergeUnique(hunter?.genericEmails) : [],
    linkedinHandle: linkedinVerified ? hunterLinkedin : undefined,
    logoUrl: domainVerified ? hunter?.logoUrl : undefined,
    serpPosition: domainVerified || (!hunterDomain && serpDomain) ? serp?.serpPosition : undefined,
    serpSnippet: canUseSerpCopy ? serp?.serpSnippet : undefined,
    domainVerified,
    linkedinVerified,
    descriptionSource: description ? "serp" : undefined,
  };
}

export async function enrichCompany(company: CompanyProfile): Promise<CompanyEnrichment> {
  const domainPromise = resolveHunterDomain(company.name);
  const newsPromise = getCompanyNews(company.name);

  const domain = await domainPromise;
  const [initialHunter, serpResult, newsResult] = await Promise.all([
    domain ? getHunterCompanyIntelligence(domain) : Promise.resolve(null),
    getSerpWebIntelligence(company.name, domain),
    newsPromise,
  ]);

  const fallbackDomain = domain || serpResult.web?.domain;
  const hunterResult =
    initialHunter ||
    (fallbackDomain ? await getHunterCompanyIntelligence(fallbackDomain) : null);

  const evidence: SourceEvidence[] = [
    hunterResult?.evidence,
    serpResult.evidence,
    newsResult.evidence,
  ].filter((item): item is SourceEvidence => Boolean(item));

  return {
    web: mergeWebIntelligence(hunterResult?.web, serpResult.web),
    news: newsResult.news,
    legalEvents: [],
    evidence,
  };
}

export function factsFromEnrichment(enrichment: CompanyEnrichment): CompanyFact[] {
  const facts: CompanyFact[] = [];
  const hunterEvidence = enrichment.evidence.find((item) => item.providerId === "hunter");
  const apiLayerEvidence = enrichment.evidence.find((item) => item.providerId === "apilayer");
  const web = enrichment.web;

  if (web && hunterEvidence) {
    const hunterCandidates: Array<[CompanyFact["type"], string, string | number | boolean | null | string[]]> = [
      ["web", "web_domain", web.domain || null],
      ["web", "website_url", web.websiteUrl || null],
      ["web", "web_industry", web.industry || null],
      ["web", "web_sector", web.sector || null],
      ["workforce", "hunter_employee_estimate", web.employeeEstimate || null],
      ["web", "web_traffic_rank", web.trafficRank || null],
      ["web", "web_technologies", web.technologies],
      ["commercial", "generic_email_count", web.genericEmails.length],
      ["commercial", "public_phone_count", web.phoneNumbers.length],
      ["web", "web_domain_verified", Boolean(web.domainVerified)],
      ["web", "linkedin_verified", Boolean(web.linkedinVerified)],
    ];
    for (const [type, key, value] of hunterCandidates) facts.push(createFact(type, key, value, hunterEvidence));
  }

  if (web && apiLayerEvidence) {
    const serpCandidates: Array<[CompanyFact["type"], string, string | number | boolean | null | string[]]> = [
      ["web", "web_description", web.description || null],
      ["web", "serp_position", web.serpPosition ?? null],
      ["web", "linkedin_handle", web.linkedinHandle || null],
    ];
    for (const [type, key, value] of serpCandidates) facts.push(createFact(type, key, value, apiLayerEvidence));
  }

  if (apiLayerEvidence) {
    facts.push(createFact("news", "recent_news_count", enrichment.news.length, apiLayerEvidence));
    if (enrichment.news.length) {
      facts.push(
        createFact(
          "news",
          "recent_news_titles",
          enrichment.news.map((item) => item.title).slice(0, 6),
          apiLayerEvidence,
        ),
      );
    }
  }

  const bodaccEvidence = enrichment.evidence.find((item) => item.providerId === "bodacc");
  if (bodaccEvidence) {
    const recent = enrichment.legalEvents;
    facts.push(createFact("commercial", "bodacc_event_count", recent.length, bodaccEvidence));
    facts.push(createFact("commercial", "bodacc_latest_event_id", recent[0]?.id || null, bodaccEvidence));
    facts.push(createFact("commercial", "bodacc_latest_family", recent[0]?.family || null, bodaccEvidence));
    facts.push(createFact("commercial", "bodacc_critical_event_count", recent.filter((event) => event.risk === "critical").length, bodaccEvidence));
  }

  return facts;
}
