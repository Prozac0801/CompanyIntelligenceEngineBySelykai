import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CompanyWebIntelligence, SourceEvidence } from "@/types/company";
import { readProviderCache, writeProviderCache } from "./cache";

const MAX_HTML_BYTES = 256 * 1024;
const MAX_REDIRECTS = 2;
const VERIFY_TTL_SECONDS = 60 * 60 * 24 * 7;

interface CachedWebsiteVerification {
  verified: boolean;
  websiteUrl?: string;
  title?: string;
  description?: string;
  checkedAt: string;
}

export interface FirstPartyPage {
  html: string;
  url: string;
}

export interface FirstPartyLink {
  href: string;
  text: string;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantCompanyTokens(companyName: string): string[] {
  return normalizeText(companyName)
    .split(" ")
    .filter((token) => token.length >= 4 && ![
      "sas", "sasu", "sarl", "sa", "groupe", "group", "holding", "france", "societe", "company",
    ].includes(token));
}

export function pageMatchesCompany(companyName: string, pageText: string): boolean {
  const tokens = significantCompanyTokens(companyName);
  if (!tokens.length) return false;
  const haystack = normalizeText(pageText);
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return tokens.length === 1 ? matches === 1 : matches >= Math.min(2, tokens.length);
}

function ipv4Parts(value: string): number[] | null {
  const parts = value.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

export function isBlockedIpAddress(value: string): boolean {
  const mapped = value.toLowerCase().startsWith("::ffff:") ? value.slice(7) : value;
  const v4 = ipv4Parts(mapped);
  if (v4) {
    const [a, b] = v4;
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }

  const ipVersion = isIP(value);
  if (ipVersion !== 6) return true;
  const normalized = value.toLowerCase();
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized);
}

export function isSafeWebsiteHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized || normalized.length > 253) return false;
  if (isIP(normalized)) return false;
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized.endsWith(".internal")) return false;
  if (!normalized.includes(".")) return false;
  return /^[a-z0-9.-]+$/.test(normalized);
}

export function cleanFirstPartyDomain(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function sameSiteHostname(hostname: string, expectedDomain: string): boolean {
  return hostname.replace(/^www\./, "").toLowerCase() === expectedDomain.replace(/^www\./, "").toLowerCase();
}

async function resolvesPublicly(hostname: string): Promise<boolean> {
  if (!isSafeWebsiteHostname(hostname)) return false;
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((entry) => !isBlockedIpAddress(entry.address));
  } catch {
    return false;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let output = "";
  try {
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_HTML_BYTES - received;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      received += chunk.byteLength;
      output += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength) break;
    }
    output += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return output;
}

export function htmlVisibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTitle(html: string): string | undefined {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function htmlDescription(html: string): string | undefined {
  const patterns = [
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i,
    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(html)?.[1]?.replace(/\s+/g, " ").trim();
    if (value) return value.slice(0, 360);
  }
  return undefined;
}

export function extractHtmlLinks(html: string, baseUrl: string): FirstPartyLink[] {
  const links: FirstPartyLink[] = [];
  const regex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && links.length < 250) {
    try {
      const href = new URL(match[1], baseUrl).toString();
      const text = htmlVisibleText(match[2]).slice(0, 180);
      links.push({ href, text });
    } catch {
      // Ignore malformed links.
    }
  }
  return links;
}

export async function fetchSafeFirstPartyPage(
  candidateDomain: string,
  target: string | URL = "/",
): Promise<FirstPartyPage | null> {
  const domain = cleanFirstPartyDomain(candidateDomain);
  if (!domain || !isSafeWebsiteHostname(domain)) return null;

  let current: URL;
  try {
    current = target instanceof URL ? new URL(target.toString()) : new URL(target, `https://${domain}/`);
  } catch {
    return null;
  }
  if (current.protocol !== "https:" || !sameSiteHostname(current.hostname, domain)) return null;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (current.protocol !== "https:" || !sameSiteHostname(current.hostname, domain) || !(await resolvesPublicly(current.hostname))) return null;
    let response: Response;
    try {
      response = await fetch(current, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "SelykaiCompanyIntelligence/0.5 (+https://selykai.com)",
        },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
    } catch {
      return null;
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) return null;
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !sameSiteHostname(next.hostname, domain)) return null;
      current = next;
      continue;
    }

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return null;
    return { html: await readLimitedText(response), url: current.toString() };
  }
  return null;
}

function verificationEvidence(url: string, confidence: number): SourceEvidence {
  return {
    providerId: "selykai-engine",
    provider: "Selykai Web Verification",
    kind: "inference",
    observedAt: new Date().toISOString(),
    sourceUrl: url,
    confidence,
  };
}

export async function verifyCompanyWebsite(
  companyName: string,
  candidateDomain?: string,
): Promise<{ web?: Partial<CompanyWebIntelligence>; evidence?: SourceEvidence }> {
  const domain = cleanFirstPartyDomain(candidateDomain);
  if (!domain || !isSafeWebsiteHostname(domain)) return {};
  const cacheKey = `direct-web:v1:${domain}:${normalizeText(companyName)}`;
  const cached = await readProviderCache<CachedWebsiteVerification>(cacheKey);
  let result = cached;

  if (!result) {
    const page = await fetchSafeFirstPartyPage(domain);
    if (!page) return {};
    const title = htmlTitle(page.html);
    const description = htmlDescription(page.html);
    const verificationText = [title, description, htmlVisibleText(page.html).slice(0, 80_000)].filter(Boolean).join(" ");
    result = {
      verified: pageMatchesCompany(companyName, verificationText),
      websiteUrl: page.url,
      title,
      description,
      checkedAt: new Date().toISOString(),
    };
    await writeProviderCache("selykai-engine", cacheKey, result, VERIFY_TTL_SECONDS);
  }

  if (!result.verified) {
    return { evidence: result.websiteUrl ? verificationEvidence(result.websiteUrl, 0.5) : undefined };
  }

  return {
    web: {
      domain,
      websiteUrl: result.websiteUrl || `https://${domain}/`,
      description: result.description,
      domainVerified: true,
      descriptionSource: result.description ? "first-party-site" : undefined,
      technologies: [],
      phoneNumbers: [],
      genericEmails: [],
    },
    evidence: verificationEvidence(result.websiteUrl || `https://${domain}/`, 0.94),
  };
}
