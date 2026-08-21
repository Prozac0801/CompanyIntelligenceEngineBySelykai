import { createHash } from "node:crypto";
import { providerStatusFromHttp, recordProviderRun } from "@/lib/providers/observability";
import type { CompanyEstablishment, SourceEvidence } from "@/types/company";
import type { CompanyFact, FactValue } from "@/types/intelligence";

const INPI_API_BASE = "https://registre-national-entreprises.inpi.fr/api";
const TOKEN_TTL_MS = 5 * 60 * 1000;

interface TokenCache {
  value: string;
  expiresAt: number;
}

interface InpiAuthResponse {
  token?: string;
}

interface InpiLegalEntity {
  roleEntreprise?: string | null;
  pays?: string | null;
  siren?: string | null;
  registre?: string | null;
  denomination?: string | null;
  formeJuridique?: string | null;
  dateEffet?: string | null;
  nicSiege?: string | null;
  nomCommercial?: string | null;
  codeApe?: string | null;
}

interface InpiLegalDescription {
  objet?: string | null;
  sigle?: string | null;
  duree?: number | null;
  dateClotureExerciceSocial?: string | null;
  datePremiereCloture?: string | null;
  ess?: boolean | null;
  societeMission?: boolean | null;
  capitalVariable?: boolean | null;
  montantCapital?: number | null;
  capitalMinimum?: number | null;
  deviseCapital?: string | null;
  natureDesActivite?: string | null;
}

interface InpiAddress {
  codePays?: string | null;
  pays?: string | null;
  codePostal?: string | null;
  commune?: string | null;
  codeInseeCommune?: string | null;
  typeVoie?: string | null;
  voie?: string | null;
  voieCodifiee?: string | null;
  numVoie?: string | null;
  indiceRepetition?: string | null;
  distributionSpeciale?: string | null;
  complementLocalisation?: string | null;
  communeAncienne?: string | null;
}

interface InpiActivity {
  indicateurPrincipal?: boolean | null;
  rolePrincipalPourEntreprise?: boolean | null;
  codeApe?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

interface InpiEstablishmentDescription {
  siret?: string | null;
  indicateurEtablissementPrincipal?: boolean | null;
  dateEffet?: string | null;
  dateEffetFermeture?: string | null;
}

interface InpiEstablishmentRecord {
  descriptionEtablissement?: InpiEstablishmentDescription | null;
  adresse?: InpiAddress | null;
  activites?: InpiActivity[] | null;
  detailCessationEtablissement?: unknown;
}

interface InpiEstablishmentContainer {
  etablissementPrincipal?: InpiEstablishmentRecord | null;
  etablissementModifie?: InpiEstablishmentRecord | null;
  autresEtablissements?: InpiEstablishmentRecord[] | null;
}

interface InpiCompanyRecord {
  diffusionINSEE?: string | null;
  siren?: string | null;
  typePersonne?: string | null;
  diffusionCommerciale?: boolean | null;
  content?: {
    formeExerciceActivitePrincipale?: string | null;
    natureCreation?: {
      dateCreation?: string | null;
      formeJuridique?: string | null;
      microEntreprise?: boolean | null;
      societeEtrangere?: boolean | null;
    } | null;
    personneMorale?: (InpiEstablishmentContainer & {
      identite?: {
        entreprise?: InpiLegalEntity | null;
        description?: InpiLegalDescription | null;
      } | null;
    }) | null;
    personnePhysique?: InpiEstablishmentContainer | null;
    exploitation?: InpiEstablishmentContainer | null;
  } | null;
}

export interface InpiRneSupplement {
  facts: CompanyFact[];
  establishments: CompanyEstablishment[];
  evidence?: SourceEvidence;
}

let cachedToken: TokenCache | null = null;

function credentials() {
  const username = process.env.INPI_USERNAME?.trim();
  const password = process.env.INPI_PASSWORD;
  return username && password ? { username, password } : null;
}

export function isInpiRneConfigured(): boolean {
  return Boolean(credentials());
}

async function login(): Promise<string> {
  const auth = credentials();
  if (!auth) throw new Error("INPI RNE credentials are not configured.");

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${INPI_API_BASE}/sso/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(auth),
      cache: "no-store",
    });
  } catch (error) {
    await recordProviderRun({
      providerId: "inpi-rne",
      operation: "authenticate",
      status: "network_error",
      latencyMs: Date.now() - startedAt,
    });
    throw error;
  }

  await recordProviderRun({
    providerId: "inpi-rne",
    operation: "authenticate",
    status: providerStatusFromHttp(response.status),
    httpStatus: response.status,
    latencyMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    throw new Error(`INPI RNE authentication failed (${response.status}).`);
  }

  const data = (await response.json()) as InpiAuthResponse;
  if (!data.token) throw new Error("INPI RNE authentication returned no token.");

  cachedToken = { value: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return data.token;
}

async function token(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  return login();
}

async function getJson<T>(path: string): Promise<T | null> {
  const startedAt = Date.now();
  const perform = async (bearer: string) => {
    try {
      return await fetch(`${INPI_API_BASE}${path}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        cache: "no-store",
      });
    } catch (error) {
      await recordProviderRun({
        providerId: "inpi-rne",
        operation: "company_lookup",
        status: "network_error",
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  };

  let response = await perform(await token());
  if (response.status === 401) {
    cachedToken = null;
    response = await perform(await token(true));
  }

  await recordProviderRun({
    providerId: "inpi-rne",
    operation: "company_lookup",
    status: providerStatusFromHttp(response.status),
    httpStatus: response.status,
    latencyMs: Date.now() - startedAt,
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`INPI RNE request failed (${response.status}).`);
  return (await response.json()) as T;
}

function fingerprint(key: string, value: FactValue): string {
  return createHash("sha256").update(`${key}:${JSON.stringify(value)}`).digest("hex");
}

function fact(
  type: CompanyFact["type"],
  key: string,
  value: FactValue,
  evidence: SourceEvidence,
): CompanyFact {
  return { type, key, value, evidence, fingerprint: fingerprint(key, value) };
}

function pushFact(
  target: CompanyFact[],
  type: CompanyFact["type"],
  key: string,
  value: FactValue | undefined,
  evidence: SourceEvidence,
) {
  if (value === undefined || value === null || value === "") return;
  target.push(fact(type, key, value, evidence));
}

function clean(value?: string | null): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function formatAddress(address?: InpiAddress | null): string | undefined {
  if (!address) return undefined;
  const street = [
    clean(address.numVoie),
    clean(address.indiceRepetition),
    clean(address.typeVoie),
    clean(address.voie || address.voieCodifiee),
  ].filter(Boolean).join(" ");
  const locality = [clean(address.codePostal), clean(address.commune)].filter(Boolean).join(" ");
  const parts = [clean(address.complementLocalisation), street, clean(address.distributionSpeciale), locality]
    .filter(Boolean);
  return parts.join(", ") || undefined;
}

function normalizeEstablishment(
  item: InpiEstablishmentRecord,
  forceHeadOffice = false,
): CompanyEstablishment | null {
  const description = item.descriptionEtablissement;
  const principalActivity = (item.activites || []).find((activity) => activity.indicateurPrincipal)
    || (item.activites || []).find((activity) => activity.rolePrincipalPourEntreprise)
    || item.activites?.[0];
  const address = formatAddress(item.adresse);
  const siret = clean(description?.siret);
  if (!siret && !address) return null;

  return {
    siret,
    address,
    postalCode: clean(item.adresse?.codePostal),
    city: clean(item.adresse?.commune),
    nafCode: clean(principalActivity?.codeApe),
    active: !description?.dateEffetFermeture && !principalActivity?.dateFin && !item.detailCessationEtablissement,
    headOffice: forceHeadOffice || Boolean(description?.indicateurEtablissementPrincipal),
    createdAt: clean(principalActivity?.dateDebut || description?.dateEffet),
  };
}

export function normalizeInpiEstablishments(record: InpiCompanyRecord): CompanyEstablishment[] {
  const containers = [record.content?.personneMorale, record.content?.personnePhysique, record.content?.exploitation]
    .filter((container): container is InpiEstablishmentContainer => Boolean(container));
  const normalized: CompanyEstablishment[] = [];

  for (const container of containers) {
    if (container.etablissementPrincipal) {
      const establishment = normalizeEstablishment(container.etablissementPrincipal, true);
      if (establishment) normalized.push(establishment);
    }
    for (const item of container.autresEtablissements || []) {
      const establishment = normalizeEstablishment(item, false);
      if (establishment) normalized.push(establishment);
    }
    if (container.etablissementModifie) {
      const establishment = normalizeEstablishment(container.etablissementModifie, false);
      if (establishment) normalized.push(establishment);
    }
  }

  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = item.siret || `${item.address || ""}|${item.city || ""}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEvidence(siren: string): SourceEvidence {
  return {
    providerId: "inpi-rne",
    provider: "INPI / RNE",
    kind: "official",
    observedAt: new Date().toISOString(),
    sourceUrl: `${INPI_API_BASE}/companies/${siren}`,
    confidence: 1,
  };
}

function factsFromRecord(record: InpiCompanyRecord, siren: string, evidence: SourceEvidence): CompanyFact[] {
  const legalIdentity = record.content?.personneMorale?.identite?.entreprise;
  const legalDescription = record.content?.personneMorale?.identite?.description;
  const creation = record.content?.natureCreation;
  const facts: CompanyFact[] = [];

  pushFact(facts, "identity", "rne_siren", record.siren || siren, evidence);
  pushFact(facts, "identity", "rne_legal_name", legalIdentity?.denomination ?? undefined, evidence);
  pushFact(facts, "identity", "rne_legal_form", legalIdentity?.formeJuridique ?? creation?.formeJuridique ?? undefined, evidence);
  pushFact(facts, "activity", "rne_ape_code", legalIdentity?.codeApe ?? undefined, evidence);
  pushFact(facts, "activity", "rne_main_activity_form", record.content?.formeExerciceActivitePrincipale ?? undefined, evidence);
  pushFact(facts, "structure", "rne_creation_date", creation?.dateCreation ?? undefined, evidence);
  pushFact(facts, "structure", "rne_micro_enterprise", creation?.microEntreprise ?? undefined, evidence);
  pushFact(facts, "structure", "rne_foreign_company", creation?.societeEtrangere ?? undefined, evidence);
  pushFact(facts, "structure", "rne_social_economy", legalDescription?.ess ?? undefined, evidence);
  pushFact(facts, "structure", "rne_mission_company", legalDescription?.societeMission ?? undefined, evidence);
  pushFact(facts, "structure", "rne_variable_capital", legalDescription?.capitalVariable ?? undefined, evidence);
  pushFact(facts, "structure", "rne_capital_amount", legalDescription?.montantCapital ?? undefined, evidence);
  pushFact(facts, "structure", "rne_capital_currency", legalDescription?.deviseCapital ?? undefined, evidence);
  pushFact(facts, "structure", "rne_corporate_purpose", legalDescription?.objet ?? undefined, evidence);
  pushFact(facts, "structure", "rne_diffusion_insee", record.diffusionINSEE ?? undefined, evidence);
  pushFact(facts, "structure", "commercial_prospecting_allowed", record.diffusionCommerciale ?? undefined, evidence);

  return facts;
}

export async function getInpiRneSupplement(siren: string): Promise<InpiRneSupplement> {
  if (!/^\d{9}$/.test(siren) || !isInpiRneConfigured()) return { facts: [], establishments: [] };

  const record = await getJson<InpiCompanyRecord>(`/companies/${siren}`);
  if (!record) return { facts: [], establishments: [] };
  const evidence = buildEvidence(siren);
  return {
    facts: factsFromRecord(record, siren, evidence),
    establishments: normalizeInpiEstablishments(record),
    evidence,
  };
}

export async function getInpiRneFacts(siren: string): Promise<CompanyFact[]> {
  return (await getInpiRneSupplement(siren)).facts;
}

export interface InpiCommercialReuseDecision {
  status: "allowed" | "blocked" | "unknown";
  reason: string;
}

export function commercialReuseDecision(facts: CompanyFact[]): InpiCommercialReuseDecision {
  const flag = facts.find((item) => item.key === "commercial_prospecting_allowed");
  if (flag?.value === false) {
    return {
      status: "blocked",
      reason: "INPI/RNE indique une opposition à la réutilisation des données à des fins de prospection.",
    };
  }
  if (flag?.value === true) {
    return {
      status: "allowed",
      reason: "Aucune opposition à la diffusion commerciale n’est indiquée dans la donnée RNE observée.",
    };
  }
  return {
    status: "unknown",
    reason: "Le statut diffusionCommerciale n’est pas disponible ; aucun enrichissement de prospection ne doit être supposé autorisé.",
  };
}
