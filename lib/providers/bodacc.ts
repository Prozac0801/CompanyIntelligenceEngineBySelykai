import { readProviderCache, writeProviderCache } from "./cache";
import { providerStatusFromHttp, recordProviderRun } from "./observability";
import type { CompanyLegalEvent, SourceEvidence } from "@/types/company";

const BODACC_ENDPOINT =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

interface BodaccRecord {
  id?: string;
  dateparution?: string;
  familleavis?: string;
  familleavis_lib?: string;
  typeavis_lib?: string;
  commercant?: string;
  ville?: string;
  registre?: string;
  jugement?: unknown;
  acte?: unknown;
  modificationsgenerales?: unknown;
  radiationaurcs?: unknown;
  depot?: unknown;
  divers?: unknown;
  url_complete?: string;
}

interface BodaccResponse {
  total_count?: number;
  results?: BodaccRecord[];
}

function evidence(): SourceEvidence {
  return {
    providerId: "bodacc",
    provider: "BODACC / DILA",
    kind: "official",
    observedAt: new Date().toISOString(),
    sourceUrl: "https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-civiles-et-commerciales-bodacc",
    confidence: 1,
  };
}

function cleanText(value: string): string {
  return value.replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeText(value?: string, maxLength = 280): string | undefined {
  if (!value) return undefined;
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned;
  const window = cleaned.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "));
  const end = sentenceEnd >= 100 ? sentenceEnd + 1 : maxLength;
  return `${cleaned.slice(0, end).trim()}…`;
}

function decodeStructured(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cleaned = value.trim();
  if (!cleaned || (!cleaned.startsWith("{") && !cleaned.startsWith("["))) return cleanText(value);
  try {
    return decodeStructured(JSON.parse(cleaned));
  } catch {
    return cleanText(value);
  }
}

function compactText(value: unknown): string | undefined {
  const decoded = decodeStructured(value);
  if (!decoded) return undefined;
  if (typeof decoded === "string") return summarizeText(decoded, 300);
  if (typeof decoded !== "object") return summarizeText(String(decoded), 300);

  const values: string[] = [];
  const visit = (node: unknown, depth = 0) => {
    if (depth > 4 || values.join(" ").length > 320) return;
    const current = decodeStructured(node);
    if (typeof current === "string" && current.trim()) {
      values.push(cleanText(current));
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 6)) visit(item, depth + 1);
      return;
    }
    if (current && typeof current === "object") {
      for (const child of Object.values(current as Record<string, unknown>).slice(0, 14)) visit(child, depth + 1);
    }
  };
  visit(decoded);
  return summarizeText(values.join(" · "), 300);
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  const decoded = decodeStructured(value);
  return decoded && !Array.isArray(decoded) && typeof decoded === "object" ? decoded as Record<string, unknown> : undefined;
}

function nestedObject(value: unknown, key: string): Record<string, unknown> | undefined {
  return objectValue(objectValue(value)?.[key]);
}

function field(value: unknown, ...keys: string[]): string | undefined {
  const object = objectValue(value);
  for (const key of keys) {
    const candidate = object?.[key];
    if (typeof candidate === "string" && cleanText(candidate)) return cleanText(candidate);
  }
  return undefined;
}

function formatBodaccDate(value?: string): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function joinUnique(parts: Array<string | undefined>): string | undefined {
  const seen = new Set<string>();
  const values = parts.filter((item): item is string => Boolean(item)).filter((item) => {
    const key = item.toLocaleLowerCase("fr-FR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return values.length ? values.join(" · ") : undefined;
}

export function humanizeBodaccDetail(record: Pick<BodaccRecord,
  "jugement" | "acte" | "modificationsgenerales" | "radiationaurcs" | "depot" | "divers" | "typeavis_lib"
>): string | undefined {
  if (record.depot) {
    const type = field(record.depot, "typeDepot", "type_depot");
    const closing = formatBodaccDate(field(record.depot, "dateCloture", "date_cloture"));
    const descriptive = summarizeText(field(record.depot, "descriptif", "description"), 180);
    return joinUnique([type || "Dépôt de comptes", closing ? `exercice clos le ${closing}` : undefined, descriptive]);
  }

  if (record.jugement) {
    const nature = field(record.jugement, "nature", "natureJugement", "typeJugement", "libelle");
    const detail = summarizeText(field(record.jugement, "complementJugement", "descriptif", "description"), 260);
    return joinUnique([nature, detail]) || compactText(record.jugement);
  }

  if (record.modificationsgenerales) {
    return summarizeText(field(record.modificationsgenerales, "descriptif", "description", "libelle"), 260)
      || compactText(record.modificationsgenerales);
  }

  if (record.acte) {
    const vente = nestedObject(record.acte, "vente");
    const descriptive = summarizeText(field(record.acte, "descriptif", "description", "libelle"), 260);
    const category = field(vente, "categorieVente", "categorie_vente");
    const effectiveDate = formatBodaccDate(field(record.acte, "dateCommencementActivite", "date_effet"));
    return joinUnique([
      descriptive,
      category,
      effectiveDate ? `effet au ${effectiveDate}` : undefined,
    ]) || compactText(record.acte);
  }

  if (record.radiationaurcs) {
    return summarizeText(field(record.radiationaurcs, "descriptif", "description", "libelle", "motif"), 260)
      || compactText(record.radiationaurcs);
  }

  if (record.divers) {
    return summarizeText(field(record.divers, "descriptif", "description", "libelle"), 260)
      || compactText(record.divers);
  }

  const type = record.typeavis_lib ? cleanText(record.typeavis_lib) : undefined;
  return type && !/^avis\s+(initial|rectificatif|annulation)$/i.test(type) ? type : undefined;
}

function normalizedText(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
}

export function classifyBodaccRisk(input: { code?: string; label?: string; type?: string; detail?: string }): CompanyLegalEvent["risk"] {
  const value = normalizedText(input.code, input.label, input.type, input.detail);
  if (/creation|immatriculation|etablissement principal|nouvel etablissement/.test(value)) return "positive";
  if (/radiation|conciliation/.test(value)) return "warning";
  if (/collective|procedure collective|jugement/.test(value)) {
    if (/cloture|plan de sauvegarde|plan de redressement|continuation|cession|fin de procedure|extinction/.test(value)) return "warning";
    if (/ouverture.*(liquidation|redressement|sauvegarde)|liquidation judiciaire|redressement judiciaire|conversion.*liquidation|reprise.*liquidation|cessation des paiements|traitement de sortie de crise/.test(value)) return "critical";
    return "warning";
  }
  return "neutral";
}

function eventTitle(record: BodaccRecord, family: string): string {
  const type = record.typeavis_lib ? cleanText(record.typeavis_lib) : undefined;
  if (type && !/^avis\s+(initial|rectificatif|annulation)$/i.test(type)) return type;
  return family;
}

function normalize(record: BodaccRecord): CompanyLegalEvent | null {
  if (!record.id || !record.dateparution) return null;
  const family = record.familleavis_lib || record.familleavis || "Annonce BODACC";
  const rawDetail = compactText(record.jugement || record.acte || record.modificationsgenerales || record.radiationaurcs || record.depot || record.divers);
  return {
    id: record.id,
    date: record.dateparution,
    family,
    familyCode: record.familleavis,
    title: eventTitle(record, family),
    description: humanizeBodaccDetail(record),
    url: record.url_complete,
    city: record.ville,
    risk: classifyBodaccRisk({ code: record.familleavis, label: family, type: record.typeavis_lib, detail: rawDetail }),
  };
}

function validCachedPayload(payload?: BodaccResponse | null): payload is BodaccResponse {
  return Boolean(payload && Array.isArray(payload.results));
}

export async function getBodaccEvents(siren: string, limit = 25): Promise<{ events: CompanyLegalEvent[]; evidence?: SourceEvidence }> {
  if (!/^\d{9}$/.test(siren)) return { events: [] };
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const cacheKey = `bodacc:v2:${siren}:${safeLimit}`;
  const cached = await readProviderCache<BodaccResponse>(cacheKey);
  let payload = validCachedPayload(cached) ? cached : null;
  if (!payload) {
    const url = new URL(BODACC_ENDPOINT);
    url.searchParams.set("where", `registre like \"${siren}\"`);
    url.searchParams.set("order_by", "dateparution desc");
    url.searchParams.set("limit", String(safeLimit));
    const startedAt = Date.now();
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      await recordProviderRun({ providerId: "bodacc", operation: "company_legal_events", status: providerStatusFromHttp(response.status), httpStatus: response.status, latencyMs: Date.now() - startedAt });
      if (!response.ok) return { events: [] };
      payload = (await response.json()) as BodaccResponse;
      if (!validCachedPayload(payload)) return { events: [] };
      await writeProviderCache("bodacc", cacheKey, payload, 60 * 60 * 6);
    } catch {
      await recordProviderRun({ providerId: "bodacc", operation: "company_legal_events", status: "network_error", latencyMs: Date.now() - startedAt });
      return { events: [] };
    }
  }
  return { events: (payload.results || []).map(normalize).filter((item): item is CompanyLegalEvent => Boolean(item)), evidence: evidence() };
}
