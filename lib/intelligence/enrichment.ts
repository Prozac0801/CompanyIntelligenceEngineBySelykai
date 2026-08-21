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

function mergeWeb(
  hunter?: CompanyWebIntelligence,
  serp?: Partial<CompanyWebIntelligence>,
): CompanyWebIntelligence | undefined {
  if (!hunter && !serp) return undefined;
  return {
    domain: hunter?.domain || serp?.domain,
    websiteUrl: hunter?.websiteUrl || serp?.websiteUrl,
    description: hunter?.description || serp?.description,
    industry: hunter?.industry || serp?.industry,
    sector: hunter?.sector || serp?.sector,
    employeeEstimate: hunter?.employeeEstimate || serp?.employeeEstimate,
    trafficRank: hunter?.trafficRank || serp?.trafficRank,
    technologies: mergeUnique(hunter?.technologies, serp?.technologies),
    phoneNumbers: mergeUnique(hunter?.phoneNumbers, serp?.phoneNumbers),
    genericEmails: mergeUnique(hunter?.genericEmails, serp?.genericEmails),
    linkedinHandle: hunter?.linkedinHandle || serp?.linkedinHandle,
    logoUrl: hunter?.logoUrl || serp?.logoUrl,
    serpPosition: serp?.serpPosition ?? hunter?.serpPosition,
    serpSnippet: serp?.serpSnippet || hunter?.serpSnippet,
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
    web: mergeWeb(hunterResult?.web, serpResult.web),
    news: newsResult.news,
    legalEvents: [],
    evidence,
  };
}

export function factsFromEnrichment(enrichment: CompanyEnrichment): CompanyFact[] {
  const facts: CompanyFact[] = [];
  const hunterEvidence = enrichment.evidence.find((item) => item.providerId === "hunter");
  const apiLayerEvidence = enrichment.evidence.find((item) => item.providerId === "apilayer");
  const webEvidence = hunterEvidence || apiLayerEvidence;
  const web = enrichment.web;

  if (web && webEvidence) {
    const candidates: Array<[CompanyFact["type"], string, string | number | boolean | null | string[]]> = [
      ["web", "web_domain", web.domain || null],
      ["web", "website_url", web.websiteUrl || null],
      ["web", "web_description", web.description || null],
      ["web", "web_industry", web.industry || null],
      ["web", "web_sector", web.sector || null],
      ["workforce", "hunter_employee_estimate", web.employeeEstimate || null],
      ["web", "web_traffic_rank", web.trafficRank || null],
      ["web", "web_technologies", web.technologies],
      ["commercial", "generic_email_count", web.genericEmails.length],
      ["commercial", "public_phone_count", web.phoneNumbers.length],
      ["web", "serp_position", web.serpPosition ?? null],
    ];
    for (const [type, key, value] of candidates) facts.push(createFact(type, key, value, webEvidence));
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
