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

function makeFact(
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
    ["structure", "creation_date", company.createdAt || null],
    ["governance", "executive_count", company.executives.length],
    ["governance", "executive_names", executiveNames],
  ];

  return candidates.map(([type, key, value]) => makeFact(type, key, value, source));
}

export function factMap(facts: CompanyFact[]): Map<string, CompanyFact> {
  return new Map(facts.map((fact) => [fact.key, fact]));
}
