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
  return { providerId: "apilayer", provider: "APILayer", kind: "web", observedAt: new Date().toISOString(), sourceUrl, confidence };
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
      headers: { Accept: "application/json", ...(authMode === "apikey_header" ? { apikey: key } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
    });
    await recordProviderRun({ providerId: "apilayer", operation: `${operation}:${authMode}`, status: providerStatusFromHttp(response.status), httpStatus: response.status, latencyMs: Date.now() - startedAt });
    return response;
  } catch {
    await recordProviderRun({ providerId: "apilayer", operation: `${operation}:${authMode}`, status: "network_error", latencyMs: Date.now() - startedAt });
    return null;
  }
}

async function apilayerGet<T>(
  baseUrl: string,
  params: Record<string, string>,
  operation: string,
  preferredAuth: ApiLayerAuthMode = "apikey_header",
): Promise<T | null> {
  const key = process.env.APILAYER_API_KEY?.trim();
  if (!key) return null;
  const fallbackAuth: ApiLayerAuthMode = preferredAuth === "apikey_header" ? "access_key_query" : "apikey_header";
  let response = await apilayerRequest(baseUrl, params, operation, key, preferredAuth);
  if (response && (response.status === 401 || response.status === 403)) {
    response = await apilayerRequest(baseUrl, params, operation, key, fallbackAuth);
  }
  if (!response?.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface SerpResult {
  position?: number;
  title?: string;
  url?: string;
  domain?: string;
  snippet?: string;
}

interface NormalizedSerpResponse { organic_results: SerpResult[] }
type RawObject = Record<string, unknown>;

function obj(value: unknown): RawObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawObject : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRawSerpResult(value: unknown): SerpResult | null {
  const item = obj(value);
  if (!item) return null;
  const url = text(item.url) || text(item.link);
  const domain = text(item.domain);
  const title = text(item.title);
  if (!url && !domain && !title) return null;
  return {
    position: numberValue(item.position) ?? numberValue(item.rank),
    title,
    url,
    domain,
    snippet: text(item.snippet) || text(item.description) || text(item.content),
  };
}

export function normalizeSerpstackResponse(value: unknown): NormalizedSerpResponse | null {
  const root = obj(value);
  if (!root || root.error) return null;
  if (root.success === false) return null;
  const request = obj(root.request);
  if (request?.success === false) return null;
  const data = obj(root.data);
  const results = obj(root.results);
  const candidates = root.organic_results
    ?? root.organic
    ?? data?.organic_results
    ?? data?.organic
    ?? results?.organic_results
    ?? results?.organic;
  if (!Array.isArray(candidates)) return null;
  return {
    organic_results: candidates.map(normalizeRawSerpResult).filter((item): item is SerpResult => Boolean(item)),
  };
}

const NON_OFFICIAL_DOMAINS = [
  "wikipedia.org", "linkedin.com", "facebook.com", "instagram.com", "societe.com", "pappers.fr", "verif.com", "annuaire-entreprises.data.gouv.fr",
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

function significantTokens(name: string): string[] {
  return name.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((token) => token.length >= 4 && !["sas", "sarl", "groupe", "france", "holding"].includes(token));
}

function resultMatchesCompany(result: SerpResult, companyName: string): boolean {
  const haystack = `${result.title || ""} ${result.snippet || ""}`.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = significantTokens(companyName);
  return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
}

function linkedInHandle(result: SerpResult): string | undefined {
  if (cleanDomain(result.domain || result.url) !== "linkedin.com" || !result.url) return undefined;
  try {
    const pathname = new URL(result.url).pathname.replace(/^\/+|\/+$/g, "");
    return pathname.startsWith("company/") ? pathname : undefined;
  } catch {
    return undefined;
  }
}

export async function getSerpWebIntelligence(
  companyName: string,
  preferredDomain?: string,
): Promise<{ web?: Partial<CompanyWebIntelligence>; evidence?: SourceEvidence }> {
  if (!isApiLayerProviderConfigured()) return {};
  const cacheKey = `apilayer:serp:v3:${companyName.trim().toLowerCase()}`;
  const cached = await readProviderCache<NormalizedSerpResponse>(cacheKey);
  let normalized = cached && Array.isArray(cached.organic_results) ? cached : null;
  if (!normalized) {
    const raw = await apilayerGet<unknown>(
      "https://api.serpstack.com/search",
      { query: `\"${companyName}\"`, type: "web", gl: "fr", num: "10" },
      "serp_company_presence",
      "access_key_query",
    );
    normalized = normalizeSerpstackResponse(raw);
    if (normalized) await writeProviderCache("apilayer", cacheKey, normalized, 60 * 60 * 24 * 7);
  }
  if (!normalized) return {};

  const preferred = cleanDomain(preferredDomain);
  const candidates = normalized.organic_results;
  const result = (preferred
    ? candidates.find((item) => cleanDomain(item.domain || item.url) === preferred && resultMatchesCompany(item, companyName))
    : undefined) || candidates.find((item) => candidateIsOfficial(item.domain || item.url) && resultMatchesCompany(item, companyName));
  const linkedin = candidates.find((item) => linkedInHandle(item) && resultMatchesCompany(item, companyName));
  const linkedinCompanyHandle = linkedin ? linkedInHandle(linkedin) : undefined;

  if (!result && !linkedinCompanyHandle) return { evidence: evidence("https://apilayer.com/products/serpstack/", 0.68) };
  const domain = result ? cleanDomain(result.domain || result.url) : undefined;
  return {
    web: {
      domain,
      websiteUrl: result?.url,
      serpPosition: result?.position,
      serpSnippet: result?.snippet,
      linkedinHandle: linkedinCompanyHandle,
      technologies: [], phoneNumbers: [], genericEmails: [],
    },
    evidence: evidence("https://apilayer.com/products/serpstack/", preferred && domain === preferred ? 0.92 : result ? 0.78 : 0.72),
  };
}

interface MediaStackResponse {
  data?: Array<{ title?: string; description?: string; url?: string; source?: string; language?: string; published_at?: string }>;
  success?: boolean;
  error?: unknown;
}
type ValidMediaStackResponse = MediaStackResponse & { data: NonNullable<MediaStackResponse["data"]> };

function relevantArticle(item: NonNullable<MediaStackResponse["data"]>[number], companyName: string): boolean {
  const haystack = `${item.title || ""} ${item.description || ""}`.toLocaleLowerCase("fr-FR");
  const tokens = significantTokens(companyName);
  if (tokens.length === 0) return false;
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return tokens.length === 1 ? matches === 1 : matches >= Math.min(2, tokens.length);
}

function validMediaStackResponse(value?: MediaStackResponse | null): value is ValidMediaStackResponse {
  return Boolean(value && !value.error && value.success !== false && Array.isArray(value.data));
}

export async function getCompanyNews(companyName: string): Promise<{ news: CompanyNewsItem[]; evidence?: SourceEvidence }> {
  if (!isApiLayerProviderConfigured()) return { news: [] };
  const cacheKey = `apilayer:news:v2:${companyName.trim().toLowerCase()}`;
  const cached = await readProviderCache<MediaStackResponse>(cacheKey);
  const response = validMediaStackResponse(cached) ? cached : await apilayerGet<MediaStackResponse>(
    "https://api.mediastack.com/v1/news",
    { keywords: companyName, languages: "fr,en", sort: "published_desc", limit: "10" },
    "company_news",
  );
  if (!validMediaStackResponse(response)) return { news: [] };
  if (!validMediaStackResponse(cached)) await writeProviderCache("apilayer", cacheKey, response, 60 * 60 * 6);
  const news = response.data.filter((item) => item.url && item.title && relevantArticle(item, companyName)).slice(0, 6).map((item) => ({
    title: item.title as string, description: item.description || undefined, url: item.url as string, source: item.source || undefined, publishedAt: item.published_at || undefined, language: item.language || undefined,
  }));
  return { news, evidence: evidence("https://apilayer.com/products/mediastack/", news.length ? 0.82 : 0.65) };
}

interface PositionStackResponse { data?: Array<{ latitude?: number; longitude?: number; label?: string; confidence?: number }> }

export async function geocodeCompanyAddress(address?: string): Promise<{ geo?: CompanyGeoIntelligence; evidence?: SourceEvidence }> {
  if (!isApiLayerProviderConfigured() || !address) return {};
  const cacheKey = `apilayer:geo:${address.trim().toLowerCase()}`;
  const cached = await readProviderCache<PositionStackResponse>(cacheKey);
  const response = cached || await apilayerGet<PositionStackResponse>(
    "https://api.positionstack.com/v1/forward",
    { query: address, country: "FR", limit: "1" },
    "forward_geocoding",
  );
  if (!response) return {};
  if (!cached) await writeProviderCache("apilayer", cacheKey, response, 60 * 60 * 24 * 30);
  const item = response.data?.[0];
  if (typeof item?.latitude !== "number" || typeof item.longitude !== "number") return {};
  return { geo: { latitude: item.latitude, longitude: item.longitude, label: item.label, confidence: item.confidence }, evidence: evidence("https://apilayer.com/products/positionstack/", item.confidence ?? 0.8) };
}

export function apiLayerDocsEvidence(): SourceEvidence {
  return evidence(APILAYER_DOCS, 0.75);
}
