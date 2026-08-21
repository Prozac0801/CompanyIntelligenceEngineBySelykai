import { createHash } from "node:crypto";
import type { CompanyProfile, SourceEvidence } from "@/types/company";
import type { CompanyFact, FactValue } from "@/types/intelligence";

function stableFingerprint(key: string, value: FactValue): string {
  return createHash("sha256").update(`${key}:${JSON.stringify(value)}`).digest("hex");
}

function primaryEvidence(company: CompanyProfile): SourceEvidence {
  return company.evidence[0] || {
    provider: "unknown",
    kind: "official",
    observedAt: new Date().toISOString(),
    confidence: 0.5,
  };
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function financialFactValues(raw: unknown): Array<[CompanyFact["type"], string, FactValue]> {
  if (!raw || typeof raw !== "object") return [];
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object")
    .sort(([a], [b]) => b.localeCompare(a));
  const latest = entries[0];
  const previous = entries[1];
  if (!latest) return [];
  const latestData = latest[1] as Record<string, unknown>;
  const previousData = previous?.[1] as Record<string, unknown> | undefined;
  const revenue = numberValue(latestData.ca ?? latestData.chiffre_affaires);
  const netIncome = numberValue(latestData.resultat_net ?? latestData.resultat);
  const previousRevenue = previousData ? numberValue(previousData.ca ?? previousData.chiffre_affaires) : undefined;
  const revenueGrowth = revenue !== undefined && previousRevenue !== undefined && previousRevenue !== 0
    ? ((revenue - previousRevenue) / Math.abs(previousRevenue)) * 100
    : undefined;

  return [
    ["financial", "financial_latest_year", latest[0]],
    ["financial", "financial_revenue", revenue ?? null],
    ["financial", "financial_net_income", netIncome ?? null],
    ["financial", "financial_previous_revenue", previousRevenue ?? null],
    ["financial", "financial_revenue_growth_percent", revenueGrowth ?? null],
  ];
}

export function createFact(
  type: CompanyFact["type"],
  key: string,
  value: FactValue,
  evidence: SourceEvidence,
): CompanyFact {
  return { type, key, value, evidence, fingerprint: stableFingerprint(key, value) };
}

export function factsFromCompany(company: CompanyProfile): CompanyFact[] {
  const source = primaryEvidence(company);
  const executiveNames = company.executives.map((executive) => executive.name).sort();
  const activeEstablishmentSirets = company.establishments
    .filter((establishment) => establishment.active === true && establishment.siret)
    .map((establishment) => establishment.siret as string)
    .sort();
  const closedEstablishmentSirets = company.establishments
    .filter((establishment) => establishment.active === false && establishment.siret)
    .map((establishment) => establishment.siret as string)
    .sort();
  const candidates: Array<[CompanyFact["type"], string, FactValue]> = [
    ["identity", "legal_name", company.name],
    ["identity", "administrative_status", company.status],
    ["activity", "naf_code", company.nafCode || null],
    ["activity", "activity_label", company.activityLabel || null],
    ["location", "head_office_address", company.address || null],
    ["location", "head_office_city", company.city || null],
    ["workforce", "employee_band", company.employeeBand || null],
    ["workforce", "employer", company.employer ?? null],
    ["structure", "open_establishment_count", company.openEstablishmentCount ?? null],
    ["structure", "establishment_count", company.establishmentCount ?? null],
    ["structure", "active_establishment_sirets", activeEstablishmentSirets],
    ["structure", "closed_establishment_sirets", closedEstablishmentSirets],
    ["structure", "creation_date", company.createdAt || null],
    ["governance", "executive_count", company.executives.length],
    ["governance", "executive_names", executiveNames],
    ...financialFactValues(company.rawFinancials),
  ];

  return candidates.map(([type, key, value]) => createFact(type, key, value, source));
}

export function factMap(facts: CompanyFact[]): Map<string, CompanyFact> {
  return new Map(facts.map((fact) => [fact.key, fact]));
}
