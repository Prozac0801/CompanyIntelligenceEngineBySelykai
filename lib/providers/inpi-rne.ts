import { createHash } from "node:crypto";
import type { SourceEvidence } from "@/types/company";
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
    personneMorale?: {
      identite?: {
        entreprise?: InpiLegalEntity | null;
        description?: InpiLegalDescription | null;
      } | null;
    } | null;
  } | null;
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

  const response = await fetch(`${INPI_API_BASE}/sso/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(auth),
    cache: "no-store",
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
  const perform = async (bearer: string) =>
    fetch(`${INPI_API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      cache: "no-store",
    });

  let response = await perform(await token());
  if (response.status === 401) {
    cachedToken = null;
    response = await perform(await token(true));
  }

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

export async function getInpiRneFacts(siren: string): Promise<CompanyFact[]> {
  if (!/^\d{9}$/.test(siren)) return [];
  if (!isInpiRneConfigured()) return [];

  const record = await getJson<InpiCompanyRecord>(`/companies/${siren}`);
  if (!record) return [];

  const observedAt = new Date().toISOString();
  const evidence: SourceEvidence = {
    providerId: "inpi-rne",
    provider: "INPI / RNE",
    kind: "official",
    observedAt,
    sourceUrl: `${INPI_API_BASE}/companies/${siren}`,
    confidence: 1,
  };

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
