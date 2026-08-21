import { createHash } from "node:crypto";
import { providerStatusFromHttp, recordProviderRun } from "@/lib/providers/observability";
import type { CompanyEstablishment, SourceEvidence } from "@/types/company";
import type { CompanyFact, FactValue } from "@/types/intelligence";

const INPI_API_BASE = "https://registre-national-entreprises.inpi.fr/api";
const TOKEN_TTL_MS = 5 * 60 * 1000;

interface TokenCache { value: string; expiresAt: number }
interface InpiAuthResponse { token?: string }

type JsonObject = Record<string, unknown>;

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
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(auth),
      cache: "no-store",
    });
  } catch (error) {
    await recordProviderRun({ providerId: "inpi-rne", operation: "authenticate", status: "network_error", latencyMs: Date.now() - startedAt });
    throw error;
  }
  await recordProviderRun({ providerId: "inpi-rne", operation: "authenticate", status: providerStatusFromHttp(response.status), httpStatus: response.status, latencyMs: Date.now() - startedAt });
  if (!response.ok) throw new Error(`INPI RNE authentication failed (${response.status}).`);
  const data = (await response.json()) as InpiAuthResponse;
  if (!data.token) throw new Error("INPI RNE authentication returned no token.");
  cachedToken = { value: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return data.token;
}

async function token(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  return login();
}

async function getJson(path: string): Promise<unknown | null> {
  const startedAt = Date.now();
  const perform = async (bearer: string) => fetch(`${INPI_API_BASE}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  let response: Response;
  try {
    response = await perform(await token());
    if (response.status === 401) {
      cachedToken = null;
      response = await perform(await token(true));
    }
  } catch (error) {
    await recordProviderRun({ providerId: "inpi-rne", operation: "company_lookup", status: "network_error", latencyMs: Date.now() - startedAt });
    throw error;
  }

  await recordProviderRun({ providerId: "inpi-rne", operation: "company_lookup", status: providerStatusFromHttp(response.status), httpStatus: response.status, latencyMs: Date.now() - startedAt });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`INPI RNE request failed (${response.status}).`);
  return response.json();
}

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function normalizedKey(key: string): string {
  return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function property(source: unknown, ...names: string[]): unknown {
  const obj = object(source);
  if (!obj) return undefined;
  const wanted = new Set(names.map(normalizedKey));
  for (const [key, value] of Object.entries(obj)) {
    if (wanted.has(normalizedKey(key))) return value;
  }
  return undefined;
}

function stringValue(source: unknown, ...names: string[]): string | undefined {
  const value = property(source, ...names);
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).replace(/\s+/g, " ").trim();
    return text || undefined;
  }
  return undefined;
}

function booleanValue(source: unknown, ...names: string[]): boolean | undefined {
  const value = property(source, ...names);
  return typeof value === "boolean" ? value : undefined;
}

function walkObjects(root: unknown, visitor: (value: JsonObject) => void, maxNodes = 6000): void {
  const queue: unknown[] = [root];
  const seen = new Set<object>();
  let nodes = 0;
  while (queue.length && nodes < maxNodes) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current as object)) continue;
    seen.add(current as object);
    nodes += 1;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    const obj = current as JsonObject;
    visitor(obj);
    queue.push(...Object.values(obj));
  }
}

function findFirstObject(root: unknown, predicate: (value: JsonObject) => boolean): JsonObject | undefined {
  let found: JsonObject | undefined;
  walkObjects(root, (value) => {
    if (!found && predicate(value)) found = value;
  });
  return found;
}

function deepProperty(root: unknown, ...names: string[]): unknown {
  let found: unknown;
  walkObjects(root, (value) => {
    if (found !== undefined) return;
    const candidate = property(value, ...names);
    if (candidate !== undefined && candidate !== null && candidate !== "") found = candidate;
  });
  return found;
}

function fingerprint(key: string, value: FactValue): string {
  return createHash("sha256").update(`${key}:${JSON.stringify(value)}`).digest("hex");
}

function fact(type: CompanyFact["type"], key: string, value: FactValue, evidence: SourceEvidence): CompanyFact {
  return { type, key, value, evidence, fingerprint: fingerprint(key, value) };
}

function pushFact(target: CompanyFact[], type: CompanyFact["type"], key: string, value: FactValue | undefined, evidence: SourceEvidence) {
  if (value === undefined || value === null || value === "") return;
  target.push(fact(type, key, value, evidence));
}

function addressFromRecord(record: unknown): JsonObject | undefined {
  return object(property(record, "adresse", "adresseEtablissement", "adresseEntreprise"));
}

function formatAddress(address?: JsonObject): string | undefined {
  if (!address) return undefined;
  const street = [
    stringValue(address, "numVoie", "numeroVoie"),
    stringValue(address, "indiceRepetition"),
    stringValue(address, "typeVoie"),
    stringValue(address, "voie", "voieCodifiee", "libelleVoie"),
  ].filter(Boolean).join(" ");
  const locality = [stringValue(address, "codePostal"), stringValue(address, "commune", "libelleCommune")].filter(Boolean).join(" ");
  const parts = [stringValue(address, "complementLocalisation"), street, stringValue(address, "distributionSpeciale"), locality].filter(Boolean);
  return parts.join(", ") || undefined;
}

function activityRecords(record: unknown): JsonObject[] {
  const value = property(record, "activites", "activite");
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(object).filter((item): item is JsonObject => Boolean(item));
}

function normalizeEstablishment(item: unknown, forceHeadOffice = false): CompanyEstablishment | null {
  const obj = object(item);
  if (!obj) return null;
  const description = object(property(obj, "descriptionEtablissement")) || obj;
  const activities = activityRecords(obj);
  const principalActivity = activities.find((activity) => booleanValue(activity, "indicateurPrincipal") === true)
    || activities.find((activity) => booleanValue(activity, "rolePrincipalPourEntreprise") === true)
    || activities[0];
  const addressObject = addressFromRecord(obj);
  const address = formatAddress(addressObject);
  const siret = stringValue(description, "siret") || stringValue(obj, "siret");
  if (!siret && !address) return null;
  const closingDate = stringValue(description, "dateEffetFermeture", "dateFermeture") || stringValue(principalActivity, "dateFin");
  return {
    siret,
    address,
    postalCode: stringValue(addressObject, "codePostal"),
    city: stringValue(addressObject, "commune", "libelleCommune"),
    nafCode: stringValue(principalActivity, "codeApe", "codeAPE") || stringValue(description, "codeApe", "codeAPE"),
    active: !closingDate,
    headOffice: forceHeadOffice || booleanValue(description, "indicateurEtablissementPrincipal") === true,
    createdAt: stringValue(principalActivity, "dateDebut") || stringValue(description, "dateEffet", "dateCreation"),
  };
}

function collectEstablishmentContainers(root: unknown): JsonObject[] {
  const containers: JsonObject[] = [];
  walkObjects(root, (value) => {
    if (
      property(value, "etablissementPrincipal") !== undefined
      || property(value, "autresEtablissements") !== undefined
      || property(value, "etablissementModifie") !== undefined
    ) containers.push(value);
  });
  return containers;
}

export function normalizeInpiEstablishments(record: unknown): CompanyEstablishment[] {
  const normalized: CompanyEstablishment[] = [];
  for (const container of collectEstablishmentContainers(record)) {
    const principal = property(container, "etablissementPrincipal");
    if (principal) {
      const establishment = normalizeEstablishment(principal, true);
      if (establishment) normalized.push(establishment);
    }
    const others = property(container, "autresEtablissements");
    for (const item of Array.isArray(others) ? others : []) {
      const establishment = normalizeEstablishment(item, false);
      if (establishment) normalized.push(establishment);
    }
    const modified = property(container, "etablissementModifie");
    if (modified) {
      const establishment = normalizeEstablishment(modified, false);
      if (establishment) normalized.push(establishment);
    }
  }

  const merged = new Map<string, CompanyEstablishment>();
  for (const item of normalized) {
    const key = item.siret || `${item.address || ""}|${item.city || ""}`.toLowerCase();
    if (!key) continue;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      continue;
    }
    merged.set(key, {
      ...current,
      ...Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)),
      headOffice: Boolean(current.headOffice || item.headOffice),
      active: current.active === false && item.active === false ? false : Boolean(current.active || item.active),
    });
  }
  return Array.from(merged.values());
}

function buildEvidence(siren: string): SourceEvidence {
  return { providerId: "inpi-rne", provider: "INPI / RNE", kind: "official", observedAt: new Date().toISOString(), sourceUrl: `${INPI_API_BASE}/companies/${siren}`, confidence: 1 };
}

function factsFromRecord(record: unknown, siren: string, evidence: SourceEvidence): CompanyFact[] {
  const legalIdentity = findFirstObject(record, (value) => Boolean(stringValue(value, "denomination") && (stringValue(value, "formeJuridique") || stringValue(value, "codeApe"))));
  const legalDescription = findFirstObject(record, (value) => property(value, "objet") !== undefined || property(value, "montantCapital") !== undefined);
  const creation = findFirstObject(record, (value) => property(value, "dateCreation") !== undefined && property(value, "formeJuridique") !== undefined);
  const facts: CompanyFact[] = [];

  pushFact(facts, "identity", "rne_siren", (typeof deepProperty(record, "siren") === "string" ? deepProperty(record, "siren") as string : siren), evidence);
  pushFact(facts, "identity", "rne_legal_name", stringValue(legalIdentity, "denomination"), evidence);
  pushFact(facts, "identity", "rne_legal_form", stringValue(legalIdentity, "formeJuridique") || stringValue(creation, "formeJuridique"), evidence);
  pushFact(facts, "activity", "rne_ape_code", stringValue(legalIdentity, "codeApe", "codeAPE"), evidence);
  const mainActivityForm = deepProperty(record, "formeExerciceActivitePrincipale");
  pushFact(facts, "activity", "rne_main_activity_form", typeof mainActivityForm === "string" ? mainActivityForm : undefined, evidence);
  pushFact(facts, "structure", "rne_creation_date", stringValue(creation, "dateCreation"), evidence);
  pushFact(facts, "structure", "rne_micro_enterprise", booleanValue(creation, "microEntreprise"), evidence);
  pushFact(facts, "structure", "rne_foreign_company", booleanValue(creation, "societeEtrangere"), evidence);
  pushFact(facts, "structure", "rne_social_economy", booleanValue(legalDescription, "ess"), evidence);
  pushFact(facts, "structure", "rne_mission_company", booleanValue(legalDescription, "societeMission"), evidence);
  pushFact(facts, "structure", "rne_variable_capital", booleanValue(legalDescription, "capitalVariable"), evidence);
  const capital = property(legalDescription, "montantCapital");
  pushFact(facts, "structure", "rne_capital_amount", typeof capital === "number" ? capital : undefined, evidence);
  pushFact(facts, "structure", "rne_capital_currency", stringValue(legalDescription, "deviseCapital"), evidence);
  pushFact(facts, "structure", "rne_corporate_purpose", stringValue(legalDescription, "objet"), evidence);
  const diffusionInsee = deepProperty(record, "diffusionINSEE");
  pushFact(facts, "structure", "rne_diffusion_insee", typeof diffusionInsee === "string" ? diffusionInsee : undefined, evidence);
  const diffusionCommerciale = deepProperty(record, "diffusionCommerciale");
  pushFact(facts, "structure", "commercial_prospecting_allowed", typeof diffusionCommerciale === "boolean" ? diffusionCommerciale : undefined, evidence);
  return facts;
}

export async function getInpiRneSupplement(siren: string): Promise<InpiRneSupplement> {
  if (!/^\d{9}$/.test(siren) || !isInpiRneConfigured()) return { facts: [], establishments: [] };
  const record = await getJson(`/companies/${siren}`);
  if (!record) return { facts: [], establishments: [] };
  const evidence = buildEvidence(siren);
  return { facts: factsFromRecord(record, siren, evidence), establishments: normalizeInpiEstablishments(record), evidence };
}

export async function getInpiRneFacts(siren: string): Promise<CompanyFact[]> {
  return (await getInpiRneSupplement(siren)).facts;
}

export interface InpiCommercialReuseDecision { status: "allowed" | "blocked" | "unknown"; reason: string }

export function commercialReuseDecision(facts: CompanyFact[]): InpiCommercialReuseDecision {
  const flag = facts.find((item) => item.key === "commercial_prospecting_allowed");
  if (flag?.value === false) return { status: "blocked", reason: "INPI/RNE indique une opposition à la réutilisation des données à des fins de prospection." };
  if (flag?.value === true) return { status: "allowed", reason: "Aucune opposition à la diffusion commerciale n’est indiquée dans la donnée RNE observée." };
  return { status: "unknown", reason: "Le statut diffusionCommerciale n’est pas disponible ; aucun enrichissement de prospection ne doit être supposé autorisé." };
}
