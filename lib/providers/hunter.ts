import type {
  CompanyContact,
  CompanyWebIntelligence,
  SourceEvidence,
} from "@/types/company";
import { readProviderCache, writeProviderCache } from "./cache";
import { providerStatusFromHttp, recordProviderRun } from "./observability";

const HUNTER_BASE = "https://api.hunter.io/v2";
const HUNTER_DOCS = "https://hunter.io/api-documentation/v2";

export function isHunterProviderConfigured(): boolean {
  return Boolean(process.env.HUNTER_API_KEY?.trim());
}

function hunterEvidence(confidence = 0.85): SourceEvidence {
  return {
    providerId: "hunter",
    provider: "Hunter",
    kind: "commercial",
    observedAt: new Date().toISOString(),
    sourceUrl: HUNTER_DOCS,
    confidence,
  };
}

async function hunterGet<T>(
  path: string,
  params: Record<string, string>,
  operation: string,
): Promise<T | null> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL(`${HUNTER_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("api_key", apiKey);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const latencyMs = Date.now() - startedAt;
    await recordProviderRun({
      providerId: "hunter",
      operation,
      status: providerStatusFromHttp(response.status),
      httpStatus: response.status,
      latencyMs,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    await recordProviderRun({
      providerId: "hunter",
      operation,
      status: "network_error",
      latencyMs: Date.now() - startedAt,
    });
    return null;
  }
}

interface DomainFinderResponse {
  data?: Array<{
    domain?: string;
    company_name?: string;
    logo?: string;
    email_count?: number;
  }>;
}

export async function resolveHunterDomain(companyName: string): Promise<string | undefined> {
  if (!isHunterProviderConfigured() || companyName.trim().length < 3) return undefined;
  const key = `hunter:domain:${companyName.trim().toLowerCase()}`;
  const cached = await readProviderCache<{ domain?: string }>(key);
  if (cached) return cached.domain;

  const response = await hunterGet<DomainFinderResponse>(
    "/domain-finder",
    { company: companyName.trim(), limit: "3" },
    "domain_finder",
  );
  const domain = response?.data?.find((item) => item.domain)?.domain?.toLowerCase();
  await writeProviderCache("hunter", key, { domain }, 60 * 60 * 24 * 30);
  return domain;
}

interface HunterCompanyResponse {
  data?: {
    domain?: string;
    description?: string;
    logo?: string;
    phone?: string;
    location?: string;
    category?: {
      sector?: string;
      industry?: string;
    };
    site?: {
      phoneNumbers?: string[];
      emailAddresses?: string[];
    };
    linkedin?: { handle?: string | null };
    metrics?: {
      employees?: string | null;
      trafficRank?: string | null;
    };
    tech?: string[];
  };
}

export async function getHunterCompanyIntelligence(
  domain: string,
): Promise<{ web: CompanyWebIntelligence; evidence: SourceEvidence } | null> {
  if (!isHunterProviderConfigured() || !domain) return null;
  const cleanDomain = domain.replace(/^www\./, "").toLowerCase();
  const key = `hunter:company:${cleanDomain}`;
  const cached = await readProviderCache<HunterCompanyResponse>(key);
  const response =
    cached ||
    (await hunterGet<HunterCompanyResponse>(
      "/companies/find",
      { domain: cleanDomain },
      "company_enrichment",
    ));
  if (!response?.data) return null;
  if (!cached) await writeProviderCache("hunter", key, response, 60 * 60 * 24 * 30);

  const data = response.data;
  const phoneNumbers = Array.from(
    new Set([...(data.site?.phoneNumbers || []), ...(data.phone ? [data.phone] : [])]),
  );

  return {
    web: {
      domain: data.domain || cleanDomain,
      websiteUrl: `https://${data.domain || cleanDomain}`,
      description: data.description || undefined,
      industry: data.category?.industry || undefined,
      sector: data.category?.sector || undefined,
      employeeEstimate: data.metrics?.employees || undefined,
      trafficRank: data.metrics?.trafficRank || undefined,
      technologies: (data.tech || []).slice(0, 24),
      phoneNumbers,
      genericEmails: (data.site?.emailAddresses || []).slice(0, 12),
      linkedinHandle: data.linkedin?.handle || undefined,
      logoUrl: data.logo || undefined,
    },
    evidence: hunterEvidence(0.86),
  };
}

interface DomainSearchResponse {
  data?: {
    emails?: Array<{
      value?: string;
      type?: string;
      confidence?: number;
      first_name?: string;
      last_name?: string;
      position?: string;
      department?: string;
      seniority?: string;
      verification?: { status?: string };
      sources?: Array<{ uri?: string; domain?: string }>;
    }>;
  };
}

export async function getHunterContacts(domain: string, limit = 10): Promise<CompanyContact[]> {
  if (!isHunterProviderConfigured() || !domain) return [];
  const cleanDomain = domain.replace(/^www\./, "").toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const key = `hunter:contacts:${cleanDomain}:${safeLimit}`;
  const cached = await readProviderCache<DomainSearchResponse>(key);
  const response =
    cached ||
    (await hunterGet<DomainSearchResponse>(
      "/domain-search",
      { domain: cleanDomain, limit: String(safeLimit) },
      "domain_search_contacts",
    ));
  if (!response?.data?.emails) return [];
  if (!cached) await writeProviderCache("hunter", key, response, 60 * 60 * 24 * 7);

  return response.data.emails.flatMap((item) => {
    if (!item.value) return [];
    return [{
      email: item.value,
      firstName: item.first_name || undefined,
      lastName: item.last_name || undefined,
      position: item.position || undefined,
      department: item.department || undefined,
      seniority: item.seniority || undefined,
      type: item.type || undefined,
      confidence: typeof item.confidence === "number" ? item.confidence : undefined,
      verificationStatus: item.verification?.status || undefined,
      sources: (item.sources || []).flatMap((source) => source.uri || source.domain || []).slice(0, 5),
    } satisfies CompanyContact];
  });
}
