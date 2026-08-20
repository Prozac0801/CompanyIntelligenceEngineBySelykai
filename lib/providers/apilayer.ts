import type {
  CompanyGeoIntelligence,
  CompanyNewsItem,
  CompanyWebIntelligence,
  SourceEvidence,
} from "@/types/company";
import { readProviderCache, writeProviderCache } from "./cache";
import { providerStatusFromHttp, recordProviderRun } from "./observability";

const APILAYER_DOCS = "https://apilayer.com/products";

type ApiLayerAuthMode = "apikey_header" | "access_key_query";

export function isApiLayerProviderConfigured(): boolean {
  return Boolean(process.env.APILAYER_API_KEY?.trim());
}

function evidence(sourceUrl: string, confidence = 0.8): SourceEvidence {
  return {
    providerId: "apilayer",
    provider: "APILayer",
    kind: "web",
    observedAt: new Date().toISOString(),
    sourceUrl,
    confidence,
  };
}

async function apilayerRequest(
  baseUrl: string,
  params: Record<string, string>,
  operation: string,
  key: string,
  authMode: ApiLayerAuthMode,
): Promise<Response | null> {
  const url = new URL(baseUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  if (authMode === "access_key_query") url.searchParams.set("access_key", key);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(authMode === "apikey_header" ? { apikey: key } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
    });
    await recordProviderRun({
      providerId: "apilayer",
      operation: `${operation}:${authMode}`,
      status: providerStatusFromHttp(response.status),
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt,
    });
    return response;
  } catch {
    await recordProviderRun({
      providerId: "apilayer",
      operation: `${operation}:${authMode}`,
      status: "network_error",
      latencyMs: Date.now() - startedAt,
    });
    return null;
  }
}

async function apilayerGet<T>(
  baseUrl: string,
  params: Record<string, string>,
  operation: string,
): Promise<T | null> {
  const key = process.env.APILAYER_API_KEY?.trim();
  if (!key) return null;

  // The current APILayer Marketplace authenticates with the `apikey` header,
  // while migrated Suite products still document `access_key` on legacy product hosts.
  // Prefer the current header mode, then retry once with the legacy query mode on auth failure.
  let response = await apilayerRequest(baseUrl, params, operation, key, "apikey_header");
  if (response && (response.status === 401 || response.status === 403)) {
    response = await apilayerRequest(baseUrl, params, operation, key, "access_key_query");
  }

  if (!response?.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface SerpResponse {
  organic_results?: Array<{
    position?: number;
    title?: string;
    url?: string;
    domain?: string;
    snippet?: string;
  }>;
}

const NON_OFFICIAL_DOMAINS = [
  "wikipedia.org",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "societe.com",
  "pappers.fr",
  "verif.com",
  "annuaire-entreprises.data.gouv.fr",
];

function cleanDomain(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

function candidateIsOfficial(domain?: string): boolean {
  const clean = cleanDomain(domain);
  if (!clean) return false;
  return !NON_OFFICIAL_DOMAINS.some((blocked) => clean === blocked || clean.endsWith(`.${blocked}`));
}

export async function getSerpWebIntelligence(
  companyName: string,
  preferredDomain?: string,
): Promise<{ web?: Partial<CompanyWebIntelligence>; evidence?: SourceEvidence }> {
  if (!isApiLayerProviderConfigured()) return {};
  const cacheKey = `apilayer:serp:${companyName.trim().toLowerCase()}`;
  const cached = await readProviderCache<SerpResponse>(cacheKey);
  const response =
    cached ||
    (await apilayerGet<SerpResponse>(
      "https://api.serpstack.com/search",
      { query: `\"${companyName}\"`, type: "web", gl: "fr", num: "10" },
      "serp_company_presence",
    ));
  if (!response) return {};
  if (!cached) await writeProviderCache("apilayer", cacheKey, response, 60 * 60 * 24 * 7);

  const preferred = cleanDomain(preferredDomain);
  const candidates = response.organic_results || [];
  const result =
    (preferred
      ? candidates.find((item) => cleanDomain(item.domain || item.url) === preferred)
      : undefined) ||
    candidates.find((item) => candidateIsOfficial(item.domain || item.url));

  if (!result) return { evidence: evidence("https://apilayer.com/products/serpstack/", 0.72) };
  const domain = cleanDomain(result.domain || result.url);

  return {
    web: {
      domain,
      websiteUrl: result.url,
      serpPosition: result.position,
      serpSnippet: result.snippet,
      technologies: [],
      phoneNumbers: [],
      genericEmails: [],
    },
    evidence: evidence("https://apilayer.com/products/serpstack/", preferred && domain === preferred ? 0.9 : 0.72),
  };
}

interface MediaStackResponse {
  data?: Array<{
    title?: string;
    description?: string;
    url?: string;
    source?: string;
    language?: string;
    published_at?: string;
  }>;
}

function significantTokens(name: string): string[] {
  return name
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-zà-ÿ0-9 ]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !["sas", "sarl", "groupe", "france", "holding"].includes(token));
}

function relevantArticle(item: NonNullable<MediaStackResponse["data"]>[number], companyName: string): boolean {
  const haystack = `${item.title || ""} ${item.description || ""}`.toLocaleLowerCase("fr-FR");
  const tokens = significantTokens(companyName);
  if (tokens.length === 0) return false;
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return tokens.length === 1 ? matches === 1 : matches >= Math.min(2, tokens.length);
}

export async function getCompanyNews(
  companyName: string,
): Promise<{ news: CompanyNewsItem[]; evidence?: SourceEvidence }> {
  if (!isApiLayerProviderConfigured()) return { news: [] };
  const cacheKey = `apilayer:news:${companyName.trim().toLowerCase()}`;
  const cached = await readProviderCache<MediaStackResponse>(cacheKey);
  const response =
    cached ||
    (await apilayerGet<MediaStackResponse>(
      "https://api.mediastack.com/v1/news",
      { keywords: companyName, languages: "fr,en", sort: "published_desc", limit: "10" },
      "company_news",
    ));
  if (!response) return { news: [] };
  if (!cached) await writeProviderCache("apilayer", cacheKey, response, 60 * 60 * 6);

  const news = (response.data || [])
    .filter((item) => item.url && item.title && relevantArticle(item, companyName))
    .slice(0, 6)
    .map((item) => ({
      title: item.title as string,
      description: item.description || undefined,
      url: item.url as string,
      source: item.source || undefined,
      publishedAt: item.published_at || undefined,
      language: item.language || undefined,
    }));

  return {
    news,
    evidence: evidence("https://apilayer.com/products/mediastack/", news.length ? 0.82 : 0.65),
  };
}

interface PositionStackResponse {
  data?: Array<{
    latitude?: number;
    longitude?: number;
    label?: string;
    confidence?: number;
  }>;
}

export async function geocodeCompanyAddress(
  address?: string,
): Promise<{ geo?: CompanyGeoIntelligence; evidence?: SourceEvidence }> {
  if (!isApiLayerProviderConfigured() || !address) return {};
  const cacheKey = `apilayer:geo:${address.trim().toLowerCase()}`;
  const cached = await readProviderCache<PositionStackResponse>(cacheKey);
  const response =
    cached ||
    (await apilayerGet<PositionStackResponse>(
      "https://api.positionstack.com/v1/forward",
      { query: address, country: "FR", limit: "1" },
      "forward_geocoding",
    ));
  if (!response) return {};
  if (!cached) await writeProviderCache("apilayer", cacheKey, response, 60 * 60 * 24 * 30);

  const item = response.data?.[0];
  if (typeof item?.latitude !== "number" || typeof item.longitude !== "number") return {};

  return {
    geo: {
      latitude: item.latitude,
      longitude: item.longitude,
      label: item.label,
      confidence: item.confidence,
    },
    evidence: evidence("https://apilayer.com/products/positionstack/", item.confidence ?? 0.8),
  };
}

export function apiLayerDocsEvidence(): SourceEvidence {
  return evidence(APILAYER_DOCS, 0.75);
}
