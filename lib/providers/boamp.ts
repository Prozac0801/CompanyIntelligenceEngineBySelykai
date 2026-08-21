import type { CompanyProcurementAward, SourceEvidence } from "@/types/company";
import { readProviderCache, writeProviderCache } from "./cache";
import { providerStatusFromHttp, recordProviderRun } from "./observability";

const BOAMP_ENDPOINT =
  "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records";
const BOAMP_SOURCE = "https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-des-marches-publics-boamp";
const CACHE_TTL_SECONDS = 60 * 60 * 6;
const LOOKBACK_DAYS = 550;

interface BoampRecord {
  idweb?: string | null;
  id?: string | null;
  objet?: string | null;
  dateparution?: string | null;
  nomacheteur?: unknown;
  titulaire?: unknown;
  nature?: string | null;
  nature_libelle?: string | null;
  type_avis?: string | null;
  procedure_libelle?: string | null;
  type_marche?: string | null;
  url_avis?: string | null;
  donnees?: unknown;
  DONNEES?: unknown;
}

interface BoampResponse {
  total_count?: number;
  results?: BoampRecord[];
}

interface CachedAwards {
  checkedAt: string;
  awards: CompanyProcurementAward[];
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

function significantTokens(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && ![
      "sas", "sasu", "sarl", "sa", "eurl", "groupe", "group", "holding", "france", "societe",
    ].includes(token));
}

function unknownText(value: unknown, depth = 0): string {
  if (depth > 5 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => unknownText(item, depth + 1)).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .slice(0, 80)
      .map((item) => unknownText(item, depth + 1))
      .join(" ");
  }
  return "";
}

function cleanLabel(value: unknown): string | undefined {
  const text = unknownText(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 500) : undefined;
}

function compactDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function recordMatch(record: BoampRecord, companyName: string, siren: string): {
  matched: boolean;
  sirenMatched: boolean;
  confidence: number;
} {
  const holder = cleanLabel(record.titulaire) || "";
  const details = unknownText(record.donnees ?? record.DONNEES);
  const sirenMatched =
    compactDigits(holder).includes(siren) ||
    compactDigits(details).includes(siren);
  if (sirenMatched) return { matched: true, sirenMatched: true, confidence: 0.99 };

  const tokens = significantTokens(companyName);
  if (!tokens.length || (tokens.length === 1 && tokens[0].length < 5)) {
    return { matched: false, sirenMatched: false, confidence: 0 };
  }
  const holderWords = new Set(normalizeText(holder).split(" ").filter(Boolean));
  const exactNameMatch = tokens.every((token) => holderWords.has(token));
  return {
    matched: exactNameMatch,
    sirenMatched: false,
    confidence: exactNameMatch ? 0.84 : 0,
  };
}

function normalizeAward(
  record: BoampRecord,
  companyName: string,
  siren: string,
): CompanyProcurementAward | null {
  const match = recordMatch(record, companyName, siren);
  if (!match.matched || !record.dateparution) return null;
  const object = record.objet?.replace(/\s+/g, " ").trim();
  if (!object) return null;

  const id = record.idweb || record.id;
  if (!id) return null;
  const holder = cleanLabel(record.titulaire);
  const buyer = cleanLabel(record.nomacheteur);
  const url = record.url_avis || (record.idweb ? `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(record.idweb)}` : undefined);

  return {
    id,
    publishedAt: record.dateparution,
    object: object.slice(0, 650),
    buyer,
    holder,
    procedure: record.procedure_libelle || undefined,
    marketType: record.type_marche || record.nature_libelle || record.nature || record.type_avis || undefined,
    url,
    matchConfidence: match.confidence,
    sirenMatched: match.sirenMatched,
  };
}

function evidence(observedAt: string): SourceEvidence {
  return {
    providerId: "boamp",
    provider: "BOAMP / DILA",
    kind: "official",
    observedAt,
    sourceUrl: BOAMP_SOURCE,
    confidence: 1,
  };
}

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function queryForCompany(companyName: string): string {
  const escaped = companyName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `search(titulaire, "${escaped}") and dateparution >= "${isoDateDaysAgo(LOOKBACK_DAYS)}"`;
}

async function fetchBoamp(companyName: string): Promise<BoampResponse | null> {
  const url = new URL(BOAMP_ENDPOINT);
  url.searchParams.set("where", queryForCompany(companyName));
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("limit", "25");

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SelykaiCompanyIntelligence/0.5 (+https://selykai.com)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    await recordProviderRun({
      providerId: "boamp",
      operation: "company_awards_search",
      status: providerStatusFromHttp(response.status),
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as BoampResponse;
    return Array.isArray(payload.results) ? payload : null;
  } catch {
    await recordProviderRun({
      providerId: "boamp",
      operation: "company_awards_search",
      status: "network_error",
      latencyMs: Date.now() - startedAt,
    });
    return null;
  }
}

export async function getBoampAwards(
  companyName: string,
  siren: string,
): Promise<{ awards: CompanyProcurementAward[]; evidence?: SourceEvidence }> {
  if (!companyName.trim() || !/^\d{9}$/.test(siren)) return { awards: [] };
  const cacheKey = `boamp:awards:v1:${siren}`;
  const cached = await readProviderCache<CachedAwards>(cacheKey);
  if (cached?.checkedAt && Array.isArray(cached.awards)) {
    return { awards: cached.awards, evidence: evidence(cached.checkedAt) };
  }

  const payload = await fetchBoamp(companyName);
  if (!payload) return { awards: [] };
  const awards = (payload.results || [])
    .map((record) => normalizeAward(record, companyName, siren))
    .filter((award): award is CompanyProcurementAward => Boolean(award))
    .filter((award, index, all) => all.findIndex((candidate) => candidate.id === award.id) === index)
    .slice(0, 12);
  const checkedAt = new Date().toISOString();
  await writeProviderCache("boamp", cacheKey, { checkedAt, awards }, CACHE_TTL_SECONDS);
  return { awards, evidence: evidence(checkedAt) };
}
