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

function compactText(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim().slice(0, 420) || undefined;
  if (typeof value !== "object") return String(value).slice(0, 420);

  const values: string[] = [];
  const visit = (node: unknown, depth = 0) => {
    if (depth > 3 || values.join(" ").length > 380) return;
    if (typeof node === "string" && node.trim()) {
      values.push(node.replace(/\s+/g, " ").trim());
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 6)) visit(item, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      for (const child of Object.values(node as Record<string, unknown>).slice(0, 12)) visit(child, depth + 1);
    }
  };
  visit(value);
  return values.join(" · ").slice(0, 420) || undefined;
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
    // Resolved / plan states must win even when the text still contains
    // "liquidation judiciaire" or "redressement judiciaire".
    if (/cloture|plan de sauvegarde|plan de redressement|continuation|cession|fin de procedure|extinction/.test(value)) {
      return "warning";
    }
    if (
      /ouverture.*(liquidation|redressement|sauvegarde)|liquidation judiciaire|redressement judiciaire|conversion.*liquidation|reprise.*liquidation|cessation des paiements|traitement de sortie de crise/.test(value)
    ) {
      return "critical";
    }
    // A "procédures collectives" family contains both openings and closures.
    // Without a precise judgment nature, do not promote it to critical.
    return "warning";
  }

  return "neutral";
}

function normalize(record: BodaccRecord): CompanyLegalEvent | null {
  if (!record.id || !record.dateparution) return null;
  const family = record.familleavis_lib || record.familleavis || "Annonce BODACC";
  const detail = compactText(
    record.jugement || record.acte || record.modificationsgenerales || record.radiationaurcs || record.depot || record.divers,
  );
  return {
    id: record.id,
    date: record.dateparution,
    family,
    familyCode: record.familleavis,
    title: record.typeavis_lib || family,
    description: detail || record.typeavis_lib || undefined,
    url: record.url_complete,
    city: record.ville,
    risk: classifyBodaccRisk({
      code: record.familleavis,
      label: family,
      type: record.typeavis_lib,
      detail,
    }),
  };
}

export async function getBodaccEvents(
  siren: string,
  limit = 25,
): Promise<{ events: CompanyLegalEvent[]; evidence?: SourceEvidence }> {
  if (!/^\d{9}$/.test(siren)) return { events: [] };
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const cacheKey = `bodacc:${siren}:${safeLimit}`;
  const cached = await readProviderCache<BodaccResponse>(cacheKey);
  let payload = cached;

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
    events: (payload?.results || []).map(normalize).filter((item): item is CompanyLegalEvent => Boolean(item)),
    evidence: evidence(),
  };
}
