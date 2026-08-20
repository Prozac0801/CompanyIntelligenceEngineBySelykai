import type { CompanyProfile, ExplainableScore, ScoreFactor } from "@/types/company";

function yearsSince(date?: string): number | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return (Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export function computeOpportunityScore(company: CompanyProfile): ExplainableScore {
  let score = 35;
  const factors: ScoreFactor[] = [];

  if (company.status === "active") {
    score += 15;
    factors.push({ label: "Entreprise active", impact: 15, evidence: "État administratif officiel : actif" });
  }

  if (company.employer) {
    score += 12;
    factors.push({ label: "Employeur identifié", impact: 12, evidence: "Caractère employeur déclaré" });
  }

  const open = company.openEstablishmentCount || 0;
  if (open >= 2) {
    const impact = Math.min(12, 4 + Math.floor(Math.log2(open)) * 2);
    score += impact;
    factors.push({ label: "Présence multi-établissements", impact, evidence: `${open} établissements ouverts` });
  }

  if (company.executives.length > 0) {
    score += 6;
    factors.push({ label: "Gouvernance identifiable", impact: 6, evidence: `${company.executives.length} dirigeant(s) public(s) détecté(s)` });
  }

  const age = yearsSince(company.createdAt);
  if (age !== null && age <= 5) {
    score += 7;
    factors.push({ label: "Structure récente", impact: 7, evidence: `Création il y a environ ${Math.max(1, Math.round(age))} an(s)` });
  }

  score = Math.max(0, Math.min(100, score));
  const evidenceCount = factors.length;

  return {
    value: score,
    confidence: evidenceCount >= 4 ? "medium" : "low",
    label: score >= 75 ? "Signal à examiner" : score >= 55 ? "Potentiel modéré" : "Peu de signaux disponibles",
    factors,
    version: "opportunity-v0.1-open-data",
  };
}
