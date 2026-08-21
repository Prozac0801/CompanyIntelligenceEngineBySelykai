import type {
  CompanyBusinessTrigger,
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
  triggers?: CompanyBusinessTrigger[];
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

function triggerFactorLabel(trigger: CompanyBusinessTrigger): string {
  if (trigger.type === "PUBLIC_CONTRACT_AWARD") return "Marché public attribué";
  if (trigger.type === "HIRING") return "Recrutement actif";
  if (trigger.type === "ESTABLISHMENT_OPENING") return "Expansion géographique";
  if (trigger.type === "FINANCIAL_GROWTH") return "Croissance financière";
  if (trigger.type === "LEGAL_CHANGE") return "Évolution juridique";
  if (trigger.type === "NEWS") return "Actualité récente";
  return trigger.label;
}

function momentumScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const { events, signals, enrichment } = input;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  const positiveTriggers = (input.triggers || [])
    .filter((trigger) => trigger.direction !== "negative" && trigger.confidence >= 0.65)
    .sort((a, b) => b.strength * b.confidence - a.strength * a.confidence);
  const negativeTriggers = (input.triggers || []).filter((trigger) => trigger.direction === "negative");
  const legacyLegalTriggers = input.triggers === undefined
    ? enrichment.legalEvents.filter((event) => isCommercialMomentumLegalEvent(event))
    : [];
  const positiveSignals = signals.filter((signal) => !["LEGAL_RISK", "CONTRACTION"].includes(signal.type));
  const dynamicCount = positiveTriggers.length + events.length + positiveSignals.length + legacyLegalTriggers.length;

  if (dynamicCount === 0) {
    return {
      subscore: {
        id: "momentum",
        label: "Momentum",
        value: null,
        weight: 0.25,
        confidence: "low",
        status: "insufficient-data",
        evidence: negativeTriggers.length
          ? ["Des signaux récents existent mais ils sont défavorables ; aucun momentum commercial positif n’est attribué."]
          : ["Aucun déclencheur récent suffisamment documenté"],
      },
      factors,
    };
  }

  let value = 18;
  const triggerWeights = [0.45, 0.22, 0.12, 0.07];
  positiveTriggers.slice(0, 4).forEach((trigger, index) => {
    const points = Math.round(trigger.strength * trigger.confidence * triggerWeights[index]);
    value += points;
    evidence.push(`${trigger.label} · force ${trigger.strength}/100 · confiance ${Math.round(trigger.confidence * 100)}%`);
    factors.push(factor("momentum", triggerFactorLabel(trigger), points, trigger.description));
  });

  if (legacyLegalTriggers.length) {
    const points = Math.min(28, legacyLegalTriggers.length * 12);
    value += points;
    evidence.push(`${legacyLegalTriggers.length} déclencheur(s) BODACC récent(s)`);
    factors.push(factor("momentum", "Activité juridique exploitable", points, legacyLegalTriggers.slice(0, 2).map((event) => event.family).join(" · ")));
  }

  const historicalEvents = events.filter((event) => ![
    "ESTABLISHMENT_CLOSURE",
  ].includes(event.type));
  if (historicalEvents.length) {
    const points = Math.min(15, historicalEvents.length * 5);
    value += points;
    evidence.push(`${historicalEvents.length} changement(s) confirmé(s) depuis une observation précédente`);
    factors.push(factor("momentum", "Changements historisés", points, `${historicalEvents.length} évolution(s) factuelle(s)`));
  }

  if (positiveSignals.length) {
    const strongest = Math.max(...positiveSignals.map((signal) => signal.strength));
    const points = Math.min(12, Math.round(strongest * 0.12));
    value += points;
    evidence.push(`Signal différentiel maximal : ${strongest}/100`);
  }

  if (negativeTriggers.length) {
    evidence.push(`${negativeTriggers.length} signal(aux) défavorable(s) traité(s) dans Risk Exposure, sans bonus Momentum`);
  }

  const confidenceEvidence = [
    positiveTriggers.length > 0 || legacyLegalTriggers.length > 0,
    historicalEvents.length > 0,
    positiveSignals.length > 0,
    positiveTriggers.some((trigger) => trigger.confidence >= 0.9),
  ].filter(Boolean).length;

  return {
    subscore: {
      id: "momentum",
      label: "Momentum",
      value: clamp(value),
      weight: 0.25,
      confidence: confidenceForEvidence(confidenceEvidence, 3),
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

  if (web?.domainVerified && web.domain) {
    value += 25;
    evidence.push(`Domaine recoupé : ${web.domain}`);
    factors.push(factor("access", "Domaine recoupé", 25, `${web.domain} confirmé par une preuve web indépendante`));
  }
  if (web?.domainVerified && web.genericEmails.length) {
    const points = Math.min(22, 10 + web.genericEmails.length * 4);
    value += points;
    evidence.push(`${web.genericEmails.length} email(s) générique(s) sur domaine recoupé`);
    factors.push(factor("access", "Emails publics recoupés", points, `${web.genericEmails.length} adresse(s) rattachée(s) au domaine validé`));
  }
  if (web?.domainVerified && web.phoneNumbers.length) {
    const points = Math.min(18, 8 + web.phoneNumbers.length * 3);
    value += points;
    evidence.push(`${web.phoneNumbers.length} téléphone(s) public(s) sur domaine recoupé`);
  }
  if (input.company.executives.length) {
    const points = Math.min(18, 6 + input.company.executives.length * 3);
    value += points;
    evidence.push(`${input.company.executives.length} dirigeant(s) public(s)`);
    factors.push(factor("access", "Gouvernance identifiable", points, `${input.company.executives.length} mandataire(s) public(s)`));
  }
  if (web?.domainVerified && web.serpPosition) {
    value += web.serpPosition <= 3 ? 10 : 5;
    evidence.push(`Domaine recoupé retrouvé dans les résultats de recherche (#${web.serpPosition})`);
  }

  if (web?.domain && !web.domainVerified) {
    evidence.push(`Domaine candidat non recoupé : ${web.domain} — aucun point commercial attribué`);
  }

  return {
    subscore: {
      id: "access",
      label: "Commercial Access",
      value: clamp(value),
      weight: 0.2,
      confidence: confidenceForEvidence(evidence.filter((item) => !item.includes("non recoupé")).length, 4),
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

  const contractionTriggers = (input.triggers || []).filter((trigger) => trigger.direction === "negative");
  if (contractionTriggers.length) {
    const strongest = Math.max(...contractionTriggers.map((trigger) => trigger.strength * trigger.confidence));
    const points = Math.min(22, Math.max(8, Math.round(strongest * 0.2)));
    value += points;
    evidence.push(`${contractionTriggers.length} déclencheur(s) défavorable(s) récent(s)`);
    factors.push(factor("risk", "Contraction récente", points, contractionTriggers[0]?.description || contractionTriggers[0]?.label || "Signal défavorable"));
  }

  if (!evidence.length) evidence.push("Aucun signal de risque fort détecté dans les sources actuellement couvertes");
  const legalEvidenceCount = input.enrichment.legalEvents.length > 0 ? 1 : 0;
  const financialEvidenceCount = financial.revenue !== undefined || financial.netIncome !== undefined ? 1 : 0;
  const dynamicRiskEvidence = contractionTriggers.length > 0 ? 1 : 0;
  return {
    subscore: {
      id: "risk",
      label: "Risk Exposure",
      value: clamp(value),
      weight: 0.15,
      confidence: confidenceForEvidence(legalEvidenceCount + financialEvidenceCount + dynamicRiskEvidence + (input.company.status !== "unknown" ? 1 : 0), 3),
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
    ["Web recoupé", Boolean(input.enrichment.web?.domainVerified)],
    ["Firmographie web recoupée", Boolean(input.enrichment.web?.domainVerified && (input.enrichment.web?.technologies.length || input.enrichment.web?.industry))],
    ["Marchés publics", input.enrichment.evidence.some((item) => item.providerId === "boamp")],
    ["Recrutement first-party", input.enrichment.evidence.some((item) => item.provider === "Selykai Career Discovery")],
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
  const positiveTriggers = (input.triggers || []).filter((trigger) => trigger.direction !== "negative");
  const topTrigger = [...positiveTriggers].sort((a, b) => b.strength * b.confidence - a.strength * a.confidence)[0];
  const legacyPriority = clamp(
    fitValue * 0.44 + accessValue * 0.21 + (100 - riskValue) * 0.15 + (momentumValue ?? 45) * 0.2,
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
  } else if (fitValue >= 60 && momentumValue >= 50 && riskValue < 60 && topTrigger) {
    opportunity = {
      status: "triggered",
      value: clamp(fitValue * 0.42 + momentumValue * 0.33 + accessValue * 0.2 - riskValue * 0.12),
      reason: `Déclencheur documenté : ${topTrigger.label}. Le profil structurel et le niveau de risque permettent une qualification prioritaire.`,
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
      description: "La V0.5 sépare Fit, Momentum, Access, Risk et qualité des données. Momentum est alimenté par des déclencheurs datés et sourcés : marchés publics, recrutement, implantation, finance, juridique et actualités.",
      coveragePercent,
      evidenceFamilies: present,
      missingFamilies: missing,
      benchmarkStatus: "not-enough-data",
      benchmarkDescription: "Benchmark sectoriel affiché uniquement lorsqu’un échantillon comparable suffisant est disponible.",
    },
    version: "intelligence-v0.5.0",
  };
}
