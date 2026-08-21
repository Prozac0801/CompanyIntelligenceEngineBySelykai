import { providerStatusFromHttp, recordProviderRun } from "@/lib/providers/observability";
import type {
  CompanyEstablishment,
  CompanyExecutive,
  CompanyProfile,
  CompanySummary,
  SourceEvidence,
} from "@/types/company";

const API_BASE = "https://recherche-entreprises.api.gouv.fr";
const USER_AGENT =
  "CompanyIntelligenceEngineBySelykai/0.4 (+https://github.com/Prozac0801/CompanyIntelligenceEngineBySelykai)";

interface RawHeadOffice {
  siret?: string;
  activite_principale?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  commune?: string;
  etat_administratif?: string;
  caractere_employeur?: string;
  date_creation?: string;
  est_siege?: boolean;
}

interface RawExecutive {
  nom?: string;
  prenoms?: string;
  denomination?: string;
  qualite?: string;
  type_dirigeant?: string;
}

interface RawCompany {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  sigle?: string | null;
  nature_juridique?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  etat_administratif?: string;
  tranche_effectif_salarie?: string;
  categorie_entreprise?: string;
  caractere_employeur?: string;
  date_creation?: string;
  nombre_etablissements?: number;
  nombre_etablissements_ouverts?: number;
  siege?: RawHeadOffice;
  dirigeants?: RawExecutive[];
  matching_etablissements?: RawHeadOffice[];
  finances?: unknown;
}

interface RawSearchResponse {
  results?: RawCompany[];
  total_results?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
}

export interface CompanySearchResponse {
  results: CompanySummary[];
  total: number;
  page: number;
  totalPages: number;
}

function statusOf(value?: string): CompanySummary["status"] {
  if (value === "A") return "active";
  if (value === "C") return "closed";
  return "unknown";
}

function evidence(): SourceEvidence[] {
  return [
    {
      providerId: "recherche-entreprises",
      provider: "API Recherche d'entreprises",
      kind: "official",
      observedAt: new Date().toISOString(),
      sourceUrl: "https://recherche-entreprises.api.gouv.fr/docs/",
      confidence: 1,
    },
  ];
}

function normalizeCompany(raw: RawCompany): CompanySummary | null {
  if (!raw.siren) return null;
  const siege = raw.siege;

  return {
    siren: raw.siren,
    name: raw.nom_raison_sociale || raw.nom_complet || raw.siren,
    acronym: raw.sigle || undefined,
    legalForm: raw.nature_juridique,
    nafCode: raw.activite_principale || siege?.activite_principale,
    activityLabel: raw.libelle_activite_principale,
    status: statusOf(raw.etat_administratif || siege?.etat_administratif),
    address: siege?.adresse,
    postalCode: siege?.code_postal,
    city: siege?.libelle_commune || siege?.commune,
    employeeBand: raw.tranche_effectif_salarie,
    companyCategory: raw.categorie_entreprise,
    employer: (raw.caractere_employeur || siege?.caractere_employeur) === "O",
    establishmentCount: raw.nombre_etablissements,
    openEstablishmentCount: raw.nombre_etablissements_ouverts,
    createdAt: raw.date_creation || siege?.date_creation,
    evidence: evidence(),
  };
}

function executiveName(executive: RawExecutive): string {
  if (executive.denomination) return executive.denomination;
  return [executive.prenoms, executive.nom].filter(Boolean).join(" ") || "Dirigeant non nommé";
}

function normalizeExecutives(items?: RawExecutive[]): CompanyExecutive[] {
  return (items || []).slice(0, 20).map((executive) => ({
    name: executiveName(executive),
    role: executive.qualite || "Dirigeant",
    type: executive.type_dirigeant,
  }));
}

function normalizeEstablishments(raw: RawCompany): CompanyEstablishment[] {
  const items = [raw.siege, ...(raw.matching_etablissements || [])].filter(
    (item): item is RawHeadOffice => Boolean(item),
  );
  const seen = new Set<string>();

  return items
    .filter((item) => {
      const key = item.siret || item.adresse || JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100)
    .map((item) => ({
      siret: item.siret,
      address: item.adresse,
      postalCode: item.code_postal,
      city: item.libelle_commune || item.commune,
      nafCode: item.activite_principale,
      active: item.etat_administratif === "A",
      headOffice: item.est_siege,
      createdAt: item.date_creation,
    }));
}

async function request(
  params: URLSearchParams,
  revalidate: number,
  operation: "search" | "company_lookup",
): Promise<RawSearchResponse> {
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      next: { revalidate },
    });
  } catch (error) {
    await recordProviderRun({
      providerId: "recherche-entreprises",
      operation,
      status: "network_error",
      latencyMs: Date.now() - startedAt,
    });
    throw error;
  }

  await recordProviderRun({
    providerId: "recherche-entreprises",
    operation,
    status: providerStatusFromHttp(response.status),
    httpStatus: response.status,
    latencyMs: Date.now() - startedAt,
  });

  if (response.status === 429) {
    throw new Error("La source officielle limite temporairement les requêtes. Réessaie dans un instant.");
  }
  if (!response.ok) {
    throw new Error(`Source entreprise indisponible (${response.status}).`);
  }

  return (await response.json()) as RawSearchResponse;
}

export async function searchCompanies(query: string, page = 1): Promise<CompanySearchResponse> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return { results: [], total: 0, page: 1, totalPages: 0 };
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    page: String(Math.max(1, page)),
    per_page: "8",
    limite_matching_etablissements: "5",
  });
  const data = await request(params, 600, "search");

  return {
    results: (data.results || []).map(normalizeCompany).filter((item): item is CompanySummary => Boolean(item)),
    total: data.total_results || 0,
    page: data.page || page,
    totalPages: data.total_pages || 0,
  };
}

export async function getCompanyBySiren(siren: string): Promise<CompanyProfile | null> {
  if (!/^\d{9}$/.test(siren)) return null;

  const params = new URLSearchParams({
    q: siren,
    page: "1",
    per_page: "1",
    limite_matching_etablissements: "100",
    page_etablissements: "1",
  });
  const data = await request(params, 3600, "company_lookup");
  const raw = data.results?.[0];
  if (!raw) return null;
  const summary = normalizeCompany(raw);
  if (!summary) return null;

  return {
    ...summary,
    executives: normalizeExecutives(raw.dirigeants),
    establishments: normalizeEstablishments(raw),
    rawFinancials: raw.finances,
  };
}
