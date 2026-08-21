import type {
  CompanyEnrichment,
  CompanyProfile,
  ExplainableScore,
  IntelligenceScoreId,
  ScoreFactor,
  ScoreSubscore,
} from "@/types/company";
import type { CompanyEvent, CompanyFact, CompanySignal } from "@/types/intelligence";
import {
  hasRecentCriticalLegalEvent,
  isCommercialMomentumLegalEvent,
  isRecentLegalEvent,
  legalEventAgeDays,
} from "@/lib/intelligence/legal-events";

interface ScoreInput {
  company: CompanyProfile;
  facts: CompanyFact[];
  events: CompanyEvent[];
  signals: CompanySignal[];
  enrichment: CompanyEnrichment;
}

const EMPLOYEE_BAND_POINTS: Record<string, number> = {
  "00": 0, "01": 8, "02": 12, "03": 18, "11": 28, "12": 40,
  "21": 55, "22": 66, "31": 74, "32": 82, "41": 88, "42": 92,
  "51": 95, "52": 98, "53": 100,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function factor(group: IntelligenceScoreId, label: string, impact: number, evidence: string): ScoreFactor {
  return { group, label, impact: Math.round(impact), evidence };
}

function confidenceForEvidence(count: number, expected: number): "low" | "medium" | "high" {
  const ratio = expected ? count / expected : 0;
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function latestFinancial(raw: unknown): { revenue?: number; netIncome?: number; margin?: number } {
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object")
    .sort(([a], [b]) => b.localeCompare(a));
  const data = entries[0]?.[1] as Record<string, unknown> | undefined;
  if (!data) return {};
  const revenue = safeNumber(data.ca ?? data.chiffre_affaires);
  const netIncome = safeNumber(data.resultat_net ?? data.resultat);
  return {
    revenue,
    netIncome,
    margin: revenue !== undefined && revenue !== 0 && netIncome !== undefined ? (netIncome / revenue) * 100 : undefined,
  };
}

function fitScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const { company } = input;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  let value = company.status === "active" ? 22 : 4;

  if (company.status === "active") evidence.push("Entreprise administrativement active");
  if (company.employer) {
    value += 20;
    evidence.push("Employeur déclaré");
    factors.push(factor("fit", "Employeur actif", 20, "Caractère employeur issu de la source officielle"));
  }

  const size = company.employeeBand ? EMPLOYEE_BAND_POINTS[company.employeeBand] : undefined;
  if (typeof size === "number") {
    const points = Math.round(size * 0.32);
    value += points;
    evidence.push(`Tranche d’effectif ${company.employeeBand}`);
    factors.push(factor("fit", "Taille de structure", points, `Tranche d’effectif officielle ${company.employeeBand}`));
  }

  const open = company.openEstablishmentCount || 0;
  if (open > 1) {
    const points = Math.min(22, 6 + Math.round(Math.log2(open) * 4));
    value += points;
    evidence.push(`${open} établissements ouverts`);
    factors.push(factor("fit", "Empreinte multi-sites", points, `${open} établissements actuellement ouverts`));
  }

  if (company.companyCategory) {
    value += 6;
    evidence.push(`Catégorie entreprise : ${company.companyCategory}`);
  }

  return {
    subscore: {
      id: "fit",
      label: "Prospect Fit",
      value: clamp(value),
      weight: 0.4,
      confidence: confidenceForEvidence(evidence.length, 4),
      status: "scored",
      evidence,
    },
    factors,
  };
}

function momentumScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const { events, signals, enrichment } = input;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  const legalTriggers = enrichment.legalEvents.filter((event) => isCommercialMomentumLegalEvent(event));
  const nonRiskSignals = signals.filter((signal) => signal.type !== "LEGAL_RISK");
  const dynamicCount = events.length + nonRiskSignals.length + legalTriggers.length + enrichment.news.length;

  if (dynamicCount === 0) {
    return {
      subscore: {
        id: "momentum",
        label: "Momentum",
        value: null,
        weight: 0.25,
        confidence: "low",
        status: "insufficient-data",
        evidence: ["Aucun déclencheur récent suffisamment documenté"],
      },
      factors,
    };
  }

  let value = 25;
  if (events.length) {
    const points = Math.min(30, events.length * 10);
    value += points;
    evidence.push(`${events.length} changement(s) détecté(s) depuis une observation précédente`);
    factors.push(factor("momentum", "Changements historisés", points, `${events.length} évolution(s) factuelle(s)`));
  }
  if (legalTriggers.length) {
    const points = Math.min(28, legalTriggers.length * 8);
    value += points;
    evidence.push(`${legalTriggers.length} déclencheur(s) BODACC récent(s)`);
    factors.push(factor("momentum", "Activité juridique exploitable", points, legalTriggers.slice(0, 2).map((event) => event.family).join(" · ")));
  }
  if (enrichment.news.length) {
    const points = Math.min(15, 5 + enrichment.news.length * 2);
    value += points;
    evidence.push(`${enrichment.news.length} actualité(s) pertinente(s)`);
  }
  if (nonRiskSignals.length) {
    const strongest = Math.max(...nonRiskSignals.map((signal) => signal.strength));
    value += Math.round(strongest * 0.18);
    evidence.push(`Signal dérivé maximal : ${strongest}/100`);
  }

  return {
    subscore: {
      id: "momentum",
      label: "Momentum",
      value: clamp(value),
      weight: 0.25,
      confidence: confidenceForEvidence(evidence.length, 4),
      status: "scored",
      evidence,
    },
    factors,
  };
}

function accessScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const web = input.enrichment.web;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  let value = 10;

  if (web?.domain) {
    value += 25;
    evidence.push(`Domaine identifié : ${web.domain}`);
    factors.push(factor("access", "Domaine résolu", 25, web.domain));
  }
  if (web?.genericEmails.length) {
    const points = Math.min(22, 10 + web.genericEmails.length * 4);
    value += points;
    evidence.push(`${web.genericEmails.length} email(s) générique(s)`);
    factors.push(factor("access", "Emails publics", points, `${web.genericEmails.length} adresse(s) générique(s) détectée(s)`));
  }
  if (web?.phoneNumbers.length) {
    const points = Math.min(18, 8 + web.phoneNumbers.length * 3);
    value += points;
    evidence.push(`${web.phoneNumbers.length} téléphone(s) public(s)`);
  }
  if (input.company.executives.length) {
    const points = Math.min(18, 6 + input.company.executives.length * 3);
    value += points;
    evidence.push(`${input.company.executives.length} dirigeant(s) public(s)`);
    factors.push(factor("access", "Gouvernance identifiable", points, `${input.company.executives.length} mandataire(s) public(s)`));
  }
  if (web?.serpPosition) {
    value += web.serpPosition <= 3 ? 10 : 5;
    evidence.push(`Site retrouvé dans les résultats de recherche (#${web.serpPosition})`);
  }

  return {
    subscore: {
      id: "access",
      label: "Commercial Access",
      value: clamp(value),
      weight: 0.2,
      confidence: confidenceForEvidence(evidence.length, 4),
      status: "scored",
      evidence,
    },
    factors,
  };
}

function riskScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  const financial = latestFinancial(input.company.rawFinancials);
  let value = 8;

  if (input.company.status === "closed") {
    value += 70;
    evidence.push("Entreprise administrativement fermée");
    factors.push(factor("risk", "Entreprise fermée", 70, "État administratif officiel fermé"));
  }

  const recentCritical = input.enrichment.legalEvents.filter(
    (event) => event.risk === "critical" && isRecentLegalEvent(event, 365),
  );
  const olderCritical = input.enrichment.legalEvents.filter((event) => {
    if (event.risk !== "critical" || isRecentLegalEvent(event, 365)) return false;
    const age = legalEventAgeDays(event);
    return age !== null;
  });
  const recentWarnings = input.enrichment.legalEvents.filter(
    (event) => event.risk === "warning" && isRecentLegalEvent(event, 365),
  );

  if (recentCritical.length) {
    const points = Math.min(80, 65 + (recentCritical.length - 1) * 8);
    value += points;
    evidence.push(`${recentCritical.length} procédure(s) BODACC critique(s) récente(s)`);
    factors.push(factor("risk", "Procédure juridique critique récente", points, recentCritical[0]?.description || recentCritical[0]?.family || "BODACC"));
  }
  if (olderCritical.length) {
    const points = Math.min(30, 12 + olderCritical.length * 4);
    value += points;
    evidence.push(`${olderCritical.length} procédure(s) critique(s) historique(s) à contextualiser`);
  }
  if (recentWarnings.length) {
    const points = Math.min(24, recentWarnings.length * 8);
    value += points;
    evidence.push(`${recentWarnings.length} événement(s) BODACC récent(s) à surveiller`);
  }
  if (typeof financial.netIncome === "number" && financial.netIncome < 0) {
    value += 30;
    evidence.push("Résultat net négatif sur le dernier exercice disponible");
    factors.push(factor("risk", "Résultat net négatif", 30, "Dernier exercice public disponible"));
  } else if (typeof financial.margin === "number" && financial.margin < 1) {
    value += 22;
    evidence.push(`Marge nette faible : ${financial.margin.toFixed(2)} %`);
    factors.push(factor("risk", "Marge nette faible", 22, `${financial.margin.toFixed(2)} % sur le dernier exercice disponible`));
  } else if (typeof financial.margin === "number" && financial.margin < 3) {
    value += 10;
    evidence.push(`Marge nette modérée : ${financial.margin.toFixed(2)} %`);
  }

  if (!evidence.length) evidence.push("Aucun signal de risque fort détecté dans les sources actuellement couvertes");
  const legalEvidenceCount = input.enrichment.legalEvents.length > 0 ? 1 : 0;
  const financialEvidenceCount = financial.revenue !== undefined || financial.netIncome !== undefined ? 1 : 0;
  return {
    subscore: {
      id: "risk",
      label: "Risk Exposure",
      value: clamp(value),
      weight: 0.15,
      confidence: confidenceForEvidence(legalEvidenceCount + financialEvidenceCount + (input.company.status !== "unknown" ? 1 : 0), 3),
      status: "scored",
      evidence,
    },
    factors,
  };
}

export function computeOpportunityScore(input: ScoreInput): ExplainableScore {
  const fit = fitScore(input);
  const momentum = momentumScore(input);
  const access = accessScore(input);
  const risk = riskScore(input);

  const families = [
    ["Données légales", input.company.evidence.length > 0],
    ["RNE", input.facts.some((fact) => fact.key === "rne_siren" && fact.value !== null)],
    ["BODACC", input.enrichment.evidence.some((item) => item.providerId === "bodacc")],
    ["Web / SERP", Boolean(input.enrichment.web?.domain || input.enrichment.web?.websiteUrl)],
    ["Firmographie web", Boolean(input.enrichment.web?.technologies.length || input.enrichment.web?.industry)],
    ["Actualités", input.enrichment.news.length > 0],
    ["Historique interne", input.events.length > 0 || input.signals.length > 0],
  ] as const;
  const present = families.filter(([, available]) => available).map(([label]) => label);
  const missing = families.filter(([, available]) => !available).map(([label]) => label);
  const coveragePercent = Math.round((present.length / families.length) * 100);
  const confidenceValue = coveragePercent;
  const confidenceLevel: ExplainableScore["confidence"] = coveragePercent >= 80 ? "high" : coveragePercent >= 50 ? "medium" : "low";
  const confidenceSubscore: ScoreSubscore = {
    id: "confidence",
    label: "Data Confidence",
    value: confidenceValue,
    weight: 0,
    confidence: confidenceLevel,
    status: "scored",
    evidence: [`${present.length}/${families.length} familles de preuves disponibles`, ...present],
  };

  const momentumValue = momentum.subscore.value;
  const fitValue = fit.subscore.value || 0;
  const accessValue = access.subscore.value || 0;
  const riskValue = risk.subscore.value || 0;
  const recentCritical = hasRecentCriticalLegalEvent(input.enrichment.legalEvents);
  const legacyPriority = clamp(
    fitValue * 0.48 + accessValue * 0.24 + (100 - riskValue) * 0.18 + (momentumValue ?? 50) * 0.1,
  );

  let opportunity: ExplainableScore["opportunity"];
  if (recentCritical || input.company.status === "closed") {
    opportunity = {
      status: "watch",
      reason: recentCritical
        ? "Une procédure BODACC critique récente bloque toute recommandation de priorité commerciale immédiate."
        : "L’entreprise est administrativement fermée : aucune priorité commerciale immédiate n’est recommandée.",
    };
  } else if (momentumValue === null) {
    opportunity = fitValue >= 65
      ? { status: "watch", reason: "Bon profil structurel, mais aucun déclencheur récent suffisamment documenté." }
      : { status: "not-determined", reason: "Pas assez de signaux pour recommander une action commerciale immédiate." };
  } else if (fitValue >= 60 && momentumValue >= 50 && riskValue < 60) {
    opportunity = {
      status: "triggered",
      value: clamp(fitValue * 0.5 + momentumValue * 0.3 + accessValue * 0.2 - riskValue * 0.15),
      reason: "Profil commercial intéressant avec activité récente suffisamment documentée et risque maîtrisé.",
    };
  } else {
    opportunity = { status: "watch", reason: "Des signaux existent, mais ils ne justifient pas encore une priorité commerciale forte." };
  }

  return {
    value: legacyPriority,
    confidence: confidenceLevel,
    label: opportunity.status === "triggered" ? "Déclencheur commercial détecté" : opportunity.status === "watch" ? "Prospect à surveiller" : "Opportunité non déterminée",
    opportunity,
    factors: [...fit.factors, ...momentum.factors, ...access.factors, ...risk.factors]
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    subscores: [fit.subscore, momentum.subscore, access.subscore, risk.subscore, confidenceSubscore],
    basis: {
      mode: "absolute-evidence",
      description: "La V0.4 sépare attractivité, momentum, accessibilité, risque et qualité des données. Un score absent signifie données insuffisantes, pas une note moyenne.",
      coveragePercent,
      evidenceFamilies: present,
      missingFamilies: missing,
      benchmarkStatus: "not-enough-data",
      benchmarkDescription: "Benchmark sectoriel affiché uniquement lorsqu’un échantillon comparable suffisant est disponible.",
    },
    version: "intelligence-v0.4.1",
  };
}
