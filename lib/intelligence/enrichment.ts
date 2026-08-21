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
import { verifyCompanyWebsite } from "@/lib/providers/direct-web";
import { getBoampAwards } from "@/lib/providers/boamp";
import { getFirstPartyHiringIntelligence } from "@/lib/providers/careers";
import { createFact } from "./facts";

type WebsiteVerificationResult = Awaited<ReturnType<typeof verifyCompanyWebsite>>;

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
  firstParty?: Partial<CompanyWebIntelligence>,
): CompanyWebIntelligence | undefined {
  if (!hunter && !serp && !firstParty) return undefined;

  const hunterDomain = cleanDomain(hunter?.domain || hunter?.websiteUrl);
  const serpDomain = cleanDomain(serp?.domain || serp?.websiteUrl);
  const firstPartyDomain = cleanDomain(firstParty?.domain || firstParty?.websiteUrl);
  const serpCorroboratesHunter = Boolean(hunterDomain && serpDomain && hunterDomain === serpDomain);
  const firstPartyVerified = Boolean(firstParty?.domainVerified && firstPartyDomain);
  const domainVerified = Boolean(
    (firstPartyVerified && (!hunterDomain || firstPartyDomain === hunterDomain))
      || serpCorroboratesHunter,
  );
  const domain = hunterDomain || firstPartyDomain || serpDomain;

  const hunterLinkedin = cleanSocialHandle(hunter?.linkedinHandle);
  const serpLinkedin = cleanSocialHandle(serp?.linkedinHandle);
  const linkedinVerified = Boolean(hunterLinkedin && serpLinkedin && hunterLinkedin === serpLinkedin);

  const canUseFirstPartyCopy = Boolean(firstPartyVerified && firstParty?.description);
  const canUseSerpCopy = Boolean(
    serp?.serpSnippet
      && serpDomain
      && (serpCorroboratesHunter || (!hunterDomain && firstPartyVerified && serpDomain === firstPartyDomain)),
  );
  const description = canUseFirstPartyCopy ? firstParty?.description : canUseSerpCopy ? serp?.serpSnippet : undefined;

  return {
    domain,
    websiteUrl: domainVerified
      ? firstParty?.websiteUrl || serp?.websiteUrl || hunter?.websiteUrl
      : hunter?.websiteUrl || serp?.websiteUrl || firstParty?.websiteUrl,
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
    serpPosition: serpCorroboratesHunter || (!hunterDomain && domainVerified) ? serp?.serpPosition : undefined,
    serpSnippet: canUseSerpCopy ? serp?.serpSnippet : undefined,
    domainVerified,
    linkedinVerified,
    descriptionSource: canUseFirstPartyCopy ? "first-party-site" : canUseSerpCopy ? "serp" : undefined,
  };
}

export async function enrichCompany(company: CompanyProfile): Promise<CompanyEnrichment> {
  const domainPromise = resolveHunterDomain(company.name);
  const newsPromise = getCompanyNews(company.name);
  const procurementPromise = getBoampAwards(company.name, company.siren);

  const domain = await domainPromise;
  const [initialHunter, serpResult, newsResult, initialFirstParty, procurementResult] = await Promise.all([
    domain ? getHunterCompanyIntelligence(domain) : Promise.resolve(null),
    getSerpWebIntelligence(company.name, domain),
    newsPromise,
    domain
      ? verifyCompanyWebsite(company.name, domain)
      : Promise.resolve({} as WebsiteVerificationResult),
    procurementPromise,
  ]);

  const fallbackDomain = domain || serpResult.web?.domain;
  const hunterResult =
    initialHunter ||
    (fallbackDomain ? await getHunterCompanyIntelligence(fallbackDomain) : null);
  const firstPartyResult: WebsiteVerificationResult = initialFirstParty.web || initialFirstParty.evidence || !fallbackDomain
    ? initialFirstParty
    : await verifyCompanyWebsite(company.name, fallbackDomain);
  const web = mergeWebIntelligence(hunterResult?.web, serpResult.web, firstPartyResult.web);
  const hiringResult = web?.domainVerified && web.domain
    ? await getFirstPartyHiringIntelligence(company.name, web.domain)
    : {};

  const evidence: SourceEvidence[] = [
    hunterResult?.evidence,
    serpResult.evidence,
    firstPartyResult.evidence,
    newsResult.evidence,
    procurementResult.evidence,
    hiringResult.evidence,
  ].filter((item): item is SourceEvidence => Boolean(item));

  return {
    web,
    news: newsResult.news,
    legalEvents: [],
    procurementAwards: procurementResult.awards,
    hiring: hiringResult.hiring,
    evidence,
  };
}

export function factsFromEnrichment(enrichment: CompanyEnrichment): CompanyFact[] {
  const facts: CompanyFact[] = [];
  const hunterEvidence = enrichment.evidence.find((item) => item.providerId === "hunter");
  const apiLayerEvidence = enrichment.evidence.find((item) => item.providerId === "apilayer");
  const firstPartyEvidence = enrichment.evidence.find(
    (item) => item.providerId === "selykai-engine" && item.provider === "Selykai Web Verification",
  );
  const hiringEvidence = enrichment.evidence.find(
    (item) => item.providerId === "selykai-engine" && item.provider === "Selykai Career Discovery",
  );
  const boampEvidence = enrichment.evidence.find((item) => item.providerId === "boamp");
  const corroborationEvidence = firstPartyEvidence || apiLayerEvidence;
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
      ["web", "linkedin_verified", Boolean(web.linkedinVerified)],
    ];
    for (const [type, key, value] of hunterCandidates) facts.push(createFact(type, key, value, hunterEvidence));
  }

  if (web && corroborationEvidence) {
    facts.push(createFact("web", "web_domain_verified", Boolean(web.domainVerified), corroborationEvidence));
    if (web.description) facts.push(createFact("web", "web_description", web.description, corroborationEvidence));
  }

  if (web && apiLayerEvidence) {
    const serpCandidates: Array<[CompanyFact["type"], string, string | number | boolean | null | string[]]> = [
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

  if (boampEvidence) {
    const awards = enrichment.procurementAwards || [];
    facts.push(createFact("commercial", "boamp_award_count", awards.length, boampEvidence));
    facts.push(createFact("commercial", "boamp_latest_award_id", awards[0]?.id || null, boampEvidence));
    facts.push(createFact("commercial", "boamp_latest_award_date", awards[0]?.publishedAt || null, boampEvidence));
    facts.push(createFact("commercial", "boamp_award_ids", awards.map((award) => award.id).sort(), boampEvidence));
  }

  if (hiringEvidence && enrichment.hiring) {
    const hiring = enrichment.hiring;
    facts.push(createFact("workforce", "hiring_detected", hiring.hiringDetected, hiringEvidence));
    facts.push(createFact("workforce", "hiring_opening_count", hiring.activeOpeningCount ?? 0, hiringEvidence));
    facts.push(createFact("workforce", "hiring_job_titles", hiring.jobTitles, hiringEvidence));
    facts.push(createFact("workforce", "hiring_latest_posted_at", hiring.latestPostedAt || null, hiringEvidence));
    facts.push(createFact("workforce", "hiring_detection_method", hiring.method, hiringEvidence));
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
