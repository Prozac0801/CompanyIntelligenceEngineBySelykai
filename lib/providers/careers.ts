import type { CompanyHiringIntelligence, SourceEvidence } from "@/types/company";
import { readProviderCache, writeProviderCache } from "./cache";
import {
  cleanFirstPartyDomain,
  extractHtmlLinks,
  fetchSafeFirstPartyPage,
  htmlVisibleText,
  pageMatchesCompany,
} from "./direct-web";

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const MAX_CAREER_PAGES = 4;
const MAX_ATS_PAGES = 2;
const CAREER_HINT = /carri[eè]re|career|recrut|nous[-_ ]?rejoindre|join[-_ ]?us|emploi|jobs?/i;
const INTERNAL_JOB_PATH = /\/(job|jobs|offre|offres|emploi|emplois|poste|postes|position|positions|vacanc|recrutement)(\/|[-_?]|$)/i;
const GENERIC_CAREER_TEXT = /^(carri[eè]res?|careers?|recrutement|nous rejoindre|join us|emplois?|jobs?|offres? d['’]emploi|voir toutes les offres)$/i;
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
  "talentdetection.com",
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

export interface HiringPageSnapshot {
  activeOpeningCount?: number;
  jobTitles: string[];
  latestPostedAt?: string;
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
  const patterns = [
    /(\d{1,3})\s+(?:offres?\s+d['’]emploi|offres?|postes?|jobs?|opportunit[eé]s?)/i,
    /(?:offres?\s+d['’]emploi|offres?|postes?|jobs?|opportunit[eé]s?)\s*[:·-]?\s*(\d{1,3})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value <= 500) return value;
  }
  return undefined;
}

function probableJobTitle(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 160 || GENERIC_CAREER_TEXT.test(text)) return false;
  return /\b(h\s*\/\s*f|f\s*\/\s*h|technicien|ing[eé]nieur|responsable|charg[eé]|comptable|chef|commercial|op[eé]rateur|d[eé]veloppeur|manager|assistant|coordinateur|consultant|alternance|stage)\b/i.test(text);
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

function discoveredTrustedAtsUrls(html: string, baseUrl: string): string[] {
  const values: string[] = [];
  for (const link of extractHtmlLinks(html, baseUrl)) {
    try {
      const url = new URL(link.href);
      if (!isAtsHost(url.hostname)) continue;
      if (!CAREER_HINT.test(`${url.pathname} ${url.search} ${link.text}`)) continue;
      if (!values.includes(url.toString())) values.push(url.toString());
      if (values.length >= MAX_ATS_PAGES) break;
    } catch {
      // Ignore malformed ATS links.
    }
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

export function parseHiringPageSnapshot(html: string, baseUrl: string, now = Date.now()): HiringPageSnapshot {
  const structuredJobs = parseJobPostings(html, now);
  const visible = htmlVisibleText(html);
  const explicitCount = explicitOpeningCount(visible);
  const links = extractHtmlLinks(html, baseUrl);
  const jobTitles = Array.from(new Set([
    ...structuredJobs.map((job) => job.title?.replace(/\s+/g, " ").trim()).filter((title): title is string => Boolean(title)),
    ...links.map((link) => link.text.replace(/\s+/g, " ").trim()).filter(probableJobTitle),
  ])).slice(0, 12);
  const activeOpeningCount = structuredJobs.length || explicitCount || (jobTitles.length ? jobTitles.length : undefined);
  return {
    activeOpeningCount,
    jobTitles,
    latestPostedAt: latestDate(structuredJobs.map((job) => job.datePosted)),
  };
}

async function verifiedAtsSnapshot(
  companyName: string,
  url: string,
): Promise<{ snapshot: HiringPageSnapshot; url: string } | null> {
  let atsDomain: string | undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !isAtsHost(parsed.hostname)) return null;
    atsDomain = cleanFirstPartyDomain(parsed.hostname);
  } catch {
    return null;
  }
  if (!atsDomain) return null;

  const page = await fetchSafeFirstPartyPage(atsDomain, url);
  if (!page) return null;
  const visible = htmlVisibleText(page.html);
  if (!pageMatchesCompany(companyName, visible.slice(0, 120_000))) return null;
  const snapshot = parseHiringPageSnapshot(page.html, page.url);
  return snapshot.activeOpeningCount ? { snapshot, url: page.url } : null;
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
  const cacheKey = `careers:v3:${domain}`;
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
  const homeVisible = htmlVisibleText(home.html);
  if (!pageMatchesCompany(companyName, homeVisible.slice(0, 100_000))) return {};

  const homeSnapshot = parseHiringPageSnapshot(home.html, home.url);
  const candidateUrls = discoveredCareerUrls(home.html, home.url, domain);
  const trustedAtsUrls = discoveredTrustedAtsUrls(home.html, home.url);
  for (const path of DEFAULT_PATHS) {
    if (candidateUrls.length >= MAX_CAREER_PAGES) break;
    const url = new URL(path, home.url).toString();
    if (!candidateUrls.includes(url)) candidateUrls.push(url);
  }

  let careersUrl: string | undefined;
  const structuredJobs = [...parseJobPostings(home.html)];
  const discoveredJobLinks = new Set(jobLinks(home.html, home.url));
  let pageOpeningCount: number | undefined = homeSnapshot.activeOpeningCount;
  const firstPartyTitles = new Set(homeSnapshot.jobTitles);

  for (const url of candidateUrls.slice(0, MAX_CAREER_PAGES)) {
    const page = await fetchSafeFirstPartyPage(domain, url);
    if (!page) continue;
    const visible = htmlVisibleText(page.html);
    const pageLooksCareer = CAREER_HINT.test(`${page.url} ${visible.slice(0, 12_000)}`);
    const snapshot = parseHiringPageSnapshot(page.html, page.url);
    const pageJobs = parseJobPostings(page.html);
    const pageLinks = jobLinks(page.html, page.url);
    if (!pageLooksCareer && !snapshot.activeOpeningCount && pageLinks.length === 0) continue;
    careersUrl ||= page.url;
    structuredJobs.push(...pageJobs);
    pageLinks.forEach((link) => discoveredJobLinks.add(link));
    snapshot.jobTitles.forEach((title) => firstPartyTitles.add(title));
    pageOpeningCount = Math.max(pageOpeningCount || 0, snapshot.activeOpeningCount || 0) || undefined;
    for (const atsUrl of discoveredTrustedAtsUrls(page.html, page.url)) {
      if (!trustedAtsUrls.includes(atsUrl) && trustedAtsUrls.length < MAX_ATS_PAGES) trustedAtsUrls.push(atsUrl);
    }
  }

  let atsResult: Awaited<ReturnType<typeof verifiedAtsSnapshot>> = null;
  for (const url of trustedAtsUrls.slice(0, MAX_ATS_PAGES)) {
    atsResult = await verifiedAtsSnapshot(companyName, url);
    if (atsResult) break;
  }

  if (atsResult) {
    const hiring: CompanyHiringIntelligence = {
      checkedAt,
      hiringDetected: true,
      careersUrl: atsResult.url,
      activeOpeningCount: atsResult.snapshot.activeOpeningCount,
      jobTitles: atsResult.snapshot.jobTitles,
      latestPostedAt: atsResult.snapshot.latestPostedAt,
      method: "verified-ats",
    };
    await writeProviderCache("selykai-engine", cacheKey, {
      hiring,
      sourceUrl: atsResult.url,
      evidenceConfidence: 0.96,
    }, CACHE_TTL_SECONDS);
    return {
      hiring,
      evidence: evidence(atsResult.url, 0.96, checkedAt),
    };
  }

  const uniqueTitles = Array.from(new Set([
    ...firstPartyTitles,
    ...structuredJobs.map((job) => job.title?.replace(/\s+/g, " ").trim()).filter((title): title is string => Boolean(title)),
  ])).slice(0, 12);
  const structuredCount = structuredJobs.length;
  const activeOpeningCount = structuredCount || pageOpeningCount || (uniqueTitles.length ? uniqueTitles.length : undefined);
  const hiringDetected = Boolean(activeOpeningCount && activeOpeningCount > 0);
  const method: CompanyHiringIntelligence["method"] =
    structuredCount > 0
      ? "structured-data"
      : hiringDetected
        ? "first-party-links"
        : careersUrl
          ? "careers-page"
          : "not-found";
  const confidence = method === "structured-data" ? 0.97 : method === "first-party-links" ? 0.88 : method === "careers-page" ? 0.76 : 0.66;
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