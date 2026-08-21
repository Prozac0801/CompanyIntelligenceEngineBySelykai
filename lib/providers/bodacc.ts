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
  if (typeof decoded === "string") return cleanText(decoded).slice(0, 520) || undefined;
  if (typeof decoded !== "object") return String(decoded).slice(0, 520);

  const values: string[] = [];
  const visit = (node: unknown, depth = 0) => {
    if (depth > 4 || values.join(" ").length > 480) return;
    const current = decodeStructured(node);
    if (typeof current === "string" && current.trim()) {
      values.push(cleanText(current));
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 8)) visit(item, depth + 1);
      return;
    }
    if (current && typeof current === "object") {
      for (const child of Object.values(current as Record<string, unknown>).slice(0, 18)) visit(child, depth + 1);
    }
  };
  visit(decoded);
  return values.join(" · ").slice(0, 520) || undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  const decoded = decodeStructured(value);
  return decoded && !Array.isArray(decoded) && typeof decoded === "object"
    ? decoded as Record<string, unknown>
    : undefined;
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
    const descriptive = field(record.depot, "descriptif", "description");
    const label = type || "Dépôt de comptes";
    return joinUnique([label, closing ? `exercice clos le ${closing}` : undefined, descriptive]);
  }

  if (record.jugement) {
    return joinUnique([
      field(record.jugement, "nature", "natureJugement", "typeJugement", "libelle"),
      field(record.jugement, "complementJugement", "descriptif", "description"),
      compactText(record.jugement),
    ]);
  }

  if (record.modificationsgenerales) {
    return joinUnique([
      field(record.modificationsgenerales, "descriptif", "description", "libelle"),
      compactText(record.modificationsgenerales),
    ]);
  }

  if (record.acte) {
    const vente = nestedObject(record.acte, "vente");
    return joinUnique([
      field(record.acte, "descriptif", "description", "libelle"),
      field(vente, "categorieVente", "categorie_vente"),
      formatBodaccDate(field(record.acte, "dateCommencementActivite", "date_effet"))
        ? `effet au ${formatBodaccDate(field(record.acte, "dateCommencementActivite", "date_effet"))}`
        : undefined,
      compactText(record.acte),
    ]);
  }

  if (record.radiationaurcs) {
    return joinUnique([
      field(record.radiationaurcs, "descriptif", "description", "libelle", "motif"),
      compactText(record.radiationaurcs),
    ]);
  }

  if (record.divers) {
    return joinUnique([
      field(record.divers, "descriptif", "description", "libelle"),
      compactText(record.divers),
    ]);
  }

  const type = record.typeavis_lib ? cleanText(record.typeavis_lib) : undefined;
  return type && !/^avis\s+(initial|rectificatif|annulation)$/i.test(type) ? type : undefined;
}

function normalizedText(...parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

export function classifyBodaccRisk(input: {
  code?: string;
  label?: string;
  type?: string;
  detail?: string;
}): CompanyLegalEvent["risk"] {
  const value = normalizedText(input.code, input.label, input.type, input.detail);

  if (/creation|immatriculation|etablissement principal|nouvel etablissement/.test(value)) return "positive";
  if (/radiation|conciliation/.test(value)) return "warning";

  if (/collective|procedure collective|jugement/.test(value)) {
    if (/cloture|plan de sauvegarde|plan de redressement|continuation|cession|fin de procedure|extinction/.test(value)) {
      return "warning";
    }
    if (
      /ouverture.*(liquidation|redressement|sauvegarde)|liquidation judiciaire|redressement judiciaire|conversion.*liquidation|reprise.*liquidation|cessation des paiements|traitement de sortie de crise/.test(value)
    ) {
      return "critical";
    }
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
  const rawDetail = compactText(
    record.jugement || record.acte || record.modificationsgenerales || record.radiationaurcs || record.depot || record.divers,
  );
  const description = humanizeBodaccDetail(record);
  return {
    id: record.id,
    date: record.dateparution,
    family,
    familyCode: record.familleavis,
    title: eventTitle(record, family),
    description,
    url: record.url_complete,
    city: record.ville,
    risk: classifyBodaccRisk({
      code: record.familleavis,
      label: family,
      type: record.typeavis_lib,
      detail: rawDetail,
    }),
  };
}

function validCachedPayload(payload?: BodaccResponse | null): payload is BodaccResponse {
  return Boolean(payload && Array.isArray(payload.results));
}

export async function getBodaccEvents(
  siren: string,
  limit = 25,
): Promise<{ events: CompanyLegalEvent[]; evidence?: SourceEvidence }> {
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
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      await recordProviderRun({
        providerId: "bodacc",
        operation: "company_legal_events",
        status: providerStatusFromHttp(response.status),
        httpStatus: response.status,
        latencyMs: Date.now() - startedAt,
      });
      if (!response.ok) return { events: [] };
      payload = (await response.json()) as BodaccResponse;
      if (!validCachedPayload(payload)) return { events: [] };
      await writeProviderCache("bodacc", cacheKey, payload, 60 * 60 * 6);
    } catch {
      await recordProviderRun({
        providerId: "bodacc",
        operation: "company_legal_events",
        status: "network_error",
        latencyMs: Date.now() - startedAt,
      });
      return { events: [] };
    }
  }

  return {
    events: (payload.results || []).map(normalize).filter((item): item is CompanyLegalEvent => Boolean(item)),
    evidence: evidence(),
  };
}
