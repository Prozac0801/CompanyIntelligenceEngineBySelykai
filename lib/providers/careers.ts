import type { CompanyHiringIntelligence, SourceEvidence } from "@/types/company";
import { readProviderCache, writeProviderCache } from "./cache";
import {
  cleanFirstPartyDomain,
  extractHtmlLinks,
  fetchSafeFirstPartyPage,
  htmlVisibleText,
} from "./direct-web";

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const MAX_CAREER_PAGES = 4;
const CAREER_HINT = /carri[eè]re|career|recrut|nous[-_ ]?rejoindre|join[-_ ]?us|emploi|jobs?/i;
const INTERNAL_JOB_PATH = /\/(job|jobs|offre|offres|emploi|emplois|poste|postes|position|positions|vacanc|recrutement)(\/|[-_?]|$)/i;
const GENERIC_CAREER_TEXT = /^(carri[eè]res?|careers?|recrutement|nous rejoindre|join us|emplois?|jobs?)$/i;
const ATS_HOSTS = [
  "smartrecruiters.com",
  "welcometothejungle.com",
  "workdayjobs.com",
  "myworkdayjobs.com",
  "lever.co",
  "greenhouse.io",
  "teamtailor.com",
  "recruitee.com",
  "flatchr.io",
  "hellowork.com",
  "talentview.io",
];
const DEFAULT_PATHS = [
  "/recrutement",
  "/carrieres",
  "/carriere",
  "/nous-rejoindre",
  "/jobs",
  "/careers",
];

interface CachedHiringResult {
  hiring: CompanyHiringIntelligence;
  sourceUrl?: string;
  evidenceConfidence: number;
}

interface JobPostingCandidate {
  title?: string;
  datePosted?: string;
  validThrough?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameSite(url: string, domain: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() === domain;
  } catch {
    return false;
  }
}

function isAtsHost(hostname: string): boolean {
  const clean = hostname.replace(/^www\./, "").toLowerCase();
  return ATS_HOSTS.some((host) => clean === host || clean.endsWith(`.${host}`));
}

function collectJobPostings(node: unknown, target: JobPostingCandidate[]) {
  if (!node || target.length >= 80) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJobPostings(item, target);
    return;
  }
  if (typeof node !== "object") return;
  const object = node as Record<string, unknown>;
  const type = object["@type"];
  const types = Array.isArray(type) ? type.map(String) : type ? [String(type)] : [];
  if (types.some((value) => value.toLowerCase() === "jobposting")) {
    target.push({
      title: typeof object.title === "string" ? object.title : undefined,
      datePosted: typeof object.datePosted === "string" ? object.datePosted : undefined,
      validThrough: typeof object.validThrough === "string" ? object.validThrough : undefined,
    });
  }
  for (const value of Object.values(object)) collectJobPostings(value, target);
}

export function parseJobPostings(html: string, now = Date.now()): JobPostingCandidate[] {
  const jobs: JobPostingCandidate[] = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && jobs.length < 80) {
    try {
      const decoded = match[1].replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
      collectJobPostings(JSON.parse(decoded), jobs);
    } catch {
      // Invalid JSON-LD is ignored instead of making the whole enrichment fail.
    }
  }

  return jobs.filter((job) => {
    const validThrough = job.validThrough ? new Date(job.validThrough).getTime() : Number.NaN;
    if (Number.isFinite(validThrough) && validThrough < now) return false;
    const posted = job.datePosted ? new Date(job.datePosted).getTime() : Number.NaN;
    if (Number.isFinite(posted) && now - posted > 240 * 24 * 60 * 60 * 1000) return false;
    return true;
  });
}

function explicitOpeningCount(text: string): number | undefined {
  const match = /(\d{1,3})\s+(?:offres?\s+d['’]emploi|offres?|postes?|jobs?|opportunit[eé]s?)/i.exec(text);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 500 ? value : undefined;
}

function jobLinks(html: string, baseUrl: string): string[] {
  const unique = new Set<string>();
  for (const link of extractHtmlLinks(html, baseUrl)) {
    try {
      const url = new URL(link.href);
      const normalizedLabel = normalizeText(link.text);
      const ats = isAtsHost(url.hostname);
      const strongInternalPath = INTERNAL_JOB_PATH.test(`${url.pathname}${url.search}`);
      const labelLooksLikeJob = /\b(postuler|candidater|offre|poste|emploi|job|vacanc|opportunite)\b/i.test(normalizedLabel);
      if ((ats || strongInternalPath || labelLooksLikeJob) && !GENERIC_CAREER_TEXT.test(link.text.trim())) {
        unique.add(url.toString());
      }
    } catch {
      // Ignore malformed URLs.
    }
  }
  return Array.from(unique).slice(0, 80);
}

function discoveredCareerUrls(html: string, baseUrl: string, domain: string): string[] {
  const values: string[] = [];
  for (const link of extractHtmlLinks(html, baseUrl)) {
    if (!CAREER_HINT.test(`${link.href} ${link.text}`) || !isSameSite(link.href, domain)) continue;
    if (!values.includes(link.href)) values.push(link.href);
    if (values.length >= MAX_CAREER_PAGES) break;
  }
  return values;
}

function latestDate(values: Array<string | undefined>): string | undefined {
  const valid = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time);
  return valid[0]?.value;
}

function evidence(sourceUrl: string | undefined, confidence: number, observedAt: string): SourceEvidence {
  return {
    providerId: "selykai-engine",
    provider: "Selykai Career Discovery",
    kind: "inference",
    observedAt,
    sourceUrl,
    confidence,
  };
}

export async function getFirstPartyHiringIntelligence(
  companyName: string,
  candidateDomain?: string,
): Promise<{ hiring?: CompanyHiringIntelligence; evidence?: SourceEvidence }> {
  const domain = cleanFirstPartyDomain(candidateDomain);
  if (!domain) return {};
  const cacheKey = `careers:v1:${domain}`;
  const cached = await readProviderCache<CachedHiringResult>(cacheKey);
  if (cached?.hiring) {
    return {
      hiring: cached.hiring,
      evidence: evidence(cached.sourceUrl, cached.evidenceConfidence, cached.hiring.checkedAt),
    };
  }

  const checkedAt = new Date().toISOString();
  const home = await fetchSafeFirstPartyPage(domain, "/");
  if (!home) return {};

  const homeJobs = parseJobPostings(home.html);
  const homeJobLinks = jobLinks(home.html, home.url);
  const candidateUrls = discoveredCareerUrls(home.html, home.url, domain);
  for (const path of DEFAULT_PATHS) {
    if (candidateUrls.length >= MAX_CAREER_PAGES) break;
    const url = new URL(path, home.url).toString();
    if (!candidateUrls.includes(url)) candidateUrls.push(url);
  }

  let careersUrl: string | undefined;
  const structuredJobs = [...homeJobs];
  const discoveredJobLinks = new Set(homeJobLinks);
  let pageOpeningCount: number | undefined = explicitOpeningCount(htmlVisibleText(home.html));

  for (const url of candidateUrls.slice(0, MAX_CAREER_PAGES)) {
    const page = await fetchSafeFirstPartyPage(domain, url);
    if (!page) continue;
    const visible = htmlVisibleText(page.html);
    const pageLooksCareer = CAREER_HINT.test(`${page.url} ${visible.slice(0, 12_000)}`);
    const pageJobs = parseJobPostings(page.html);
    const pageLinks = jobLinks(page.html, page.url);
    if (!pageLooksCareer && pageJobs.length === 0 && pageLinks.length === 0) continue;
    careersUrl ||= page.url;
    structuredJobs.push(...pageJobs);
    pageLinks.forEach((link) => discoveredJobLinks.add(link));
    pageOpeningCount = Math.max(pageOpeningCount || 0, explicitOpeningCount(visible) || 0) || undefined;
  }

  const uniqueTitles = Array.from(new Set(
    structuredJobs.map((job) => job.title?.replace(/\s+/g, " ").trim()).filter((title): title is string => Boolean(title)),
  )).slice(0, 12);
  const structuredCount = structuredJobs.length;
  const linkCount = discoveredJobLinks.size;
  const activeOpeningCount = structuredCount || pageOpeningCount || (linkCount >= 2 ? linkCount : undefined);
  const hiringDetected = Boolean(activeOpeningCount && activeOpeningCount > 0);
  const method: CompanyHiringIntelligence["method"] =
    structuredCount > 0
      ? "structured-data"
      : hiringDetected
        ? "first-party-links"
        : careersUrl
          ? "careers-page"
          : "not-found";
  const confidence = method === "structured-data" ? 0.97 : method === "first-party-links" ? 0.86 : method === "careers-page" ? 0.76 : 0.66;
  const hiring: CompanyHiringIntelligence = {
    checkedAt,
    hiringDetected,
    careersUrl,
    activeOpeningCount,
    jobTitles: uniqueTitles,
    latestPostedAt: latestDate(structuredJobs.map((job) => job.datePosted)),
    method,
  };

  await writeProviderCache("selykai-engine", cacheKey, {
    hiring,
    sourceUrl: careersUrl || home.url,
    evidenceConfidence: confidence,
  }, CACHE_TTL_SECONDS);

  return {
    hiring,
    evidence: evidence(careersUrl || home.url, confidence, checkedAt),
  };
}
