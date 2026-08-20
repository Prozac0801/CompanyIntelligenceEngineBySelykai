import type {
  CompanyEnrichment,
  CompanyProfile,
  ExplainableScore,
  ScoreFactor,
  ScoreSubscore,
} from "@/types/company";
import type { CompanyEvent, CompanyFact, CompanySignal } from "@/types/intelligence";

interface ScoreInput {
  company: CompanyProfile;
  facts: CompanyFact[];
  events: CompanyEvent[];
  signals: CompanySignal[];
  enrichment: CompanyEnrichment;
}

const WEIGHTS: Record<ScoreSubscore["id"], number> = {
  health: 0.25,
  growth: 0.25,
  digital: 0.2,
  commercial: 0.3,
};

const EMPLOYEE_BAND_POINTS: Record<string, number> = {
  "00": 0,
  "01": 8,
  "02": 12,
  "03": 16,
  "11": 22,
  "12": 30,
  "21": 40,
  "22": 50,
  "31": 60,
  "32": 70,
  "41": 80,
  "42": 86,
  "51": 92,
  "52": 96,
  "53": 100,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function yearsSince(date?: string): number | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return (Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function hasFact(facts: CompanyFact[], key: string): boolean {
  return facts.some((fact) => fact.key === key && fact.value !== null);
}

function hasFinancials(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as object).length > 0);
}

function confidenceForEvidence(count: number, expected: number): "low" | "medium" | "high" {
  const ratio = expected ? count / expected : 0;
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

function factor(
  group: ScoreFactor["group"],
  label: string,
  impact: number,
  evidence: string,
): ScoreFactor {
  return { group, label, impact: Math.round(impact), evidence };
}

function healthScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const { company, facts } = input;
  let value = 10;
  let evidenceCount = 0;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];

  if (company.status === "active") {
    value += 30;
    evidenceCount += 1;
    evidence.push("Entreprise administrativement active");
    factors.push(factor("health", "Entreprise active", 8, "État administratif officiel : actif"));
  }

  const age = yearsSince(company.createdAt);
  if (age !== null) {
    evidenceCount += 1;
    const points = age >= 5 ? 20 : age >= 2 ? 15 : 8;
    value += points;
    evidence.push(`Ancienneté observée : ${Math.max(0, Math.floor(age))} an(s)`);
    factors.push(factor("health", "Continuité d’activité", points * WEIGHTS.health, `Création : ${company.createdAt}`));
  }

  if (company.executives.length > 0) {
    value += 15;
    evidenceCount += 1;
    evidence.push(`${company.executives.length} dirigeant(s) public(s)`);
    factors.push(factor("health", "Gouvernance identifiable", 4, `${company.executives.length} dirigeant(s) détecté(s)`));
  }

  if (hasFact(facts, "rne_siren")) {
    value += 20;
    evidenceCount += 1;
    evidence.push("Identité recoupée avec le RNE");
    factors.push(factor("health", "Recoupement RNE", 5, "SIREN confirmé par l’INPI / RNE"));
  }

  if (company.legalForm) {
    value += 5;
    evidenceCount += 1;
    evidence.push("Forme juridique disponible");
  }

  if (hasFinancials(company.rawFinancials)) {
    value += 5;
    evidenceCount += 1;
    evidence.push("Données financières publiques disponibles");
    factors.push(factor("health", "Comptes publics disponibles", 1, "Au moins un exercice financier est exposé par la source officielle"));
  }

  return {
    subscore: {
      id: "health",
      label: "Company Health",
      value: clamp(value),
      weight: WEIGHTS.health,
      confidence: confidenceForEvidence(evidenceCount, 6),
      evidence,
    },
    factors,
  };
}

function growthScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const { company, events, signals, enrichment } = input;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  const hasDynamicEvidence = events.length > 0 || signals.length > 0 || enrichment.news.length > 0;

  if (!hasDynamicEvidence) {
    return {
      subscore: {
        id: "growth",
        label: "Growth Signals",
        value: 50,
        weight: WEIGHTS.growth,
        confidence: "low",
        evidence: ["Valeur neutre : pas encore assez d’historique ou de signaux récents pour conclure"],
      },
      factors,
    };
  }

  let value = 35;
  if (events.length) {
    const eventPoints = Math.min(30, events.length * 10);
    value += eventPoints;
    evidence.push(`${events.length} changement(s) factuel(s) historisé(s)`);
    factors.push(factor("growth", "Entreprise en mouvement", eventPoints * WEIGHTS.growth, `${events.length} événement(s) nouveaux depuis l’observation précédente`));
  }

  if (signals.length) {
    const strongest = Math.max(...signals.map((signal) => signal.strength));
    const points = Math.round(strongest * 0.2);
    value += points;
    evidence.push(`Signal dérivé le plus fort : ${strongest}/100`);
    factors.push(factor("growth", "Signal de mouvement", points * WEIGHTS.growth, signals[0]?.reason || "Signal dérivé d’événements sourcés"));
  }

  if (enrichment.news.length) {
    const points = Math.min(15, 5 + enrichment.news.length * 2);
    value += points;
    evidence.push(`${enrichment.news.length} actualité(s) récente(s) pertinente(s)`);
    factors.push(factor("growth", "Visibilité récente", points * WEIGHTS.growth, `${enrichment.news.length} article(s) pertinent(s) détecté(s)`));
  }

  const age = yearsSince(company.createdAt);
  if (age !== null && age <= 5) {
    value += 8;
    evidence.push("Structure créée depuis moins de 5 ans");
  }

  return {
    subscore: {
      id: "growth",
      label: "Growth Signals",
      value: clamp(value),
      weight: WEIGHTS.growth,
      confidence: confidenceForEvidence(evidence.length, 4),
      evidence,
    },
    factors,
  };
}

function digitalScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const web = input.enrichment.web;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];

  if (!web?.domain && !web?.websiteUrl) {
    return {
      subscore: {
        id: "digital",
        label: "Digital Presence",
        value: 50,
        weight: WEIGHTS.digital,
        confidence: "low",
        evidence: ["Valeur neutre : présence web non résolue ou fournisseur indisponible"],
      },
      factors,
    };
  }

  let value = 20;
  if (web.domain) {
    value += 25;
    evidence.push(`Domaine identifié : ${web.domain}`);
    factors.push(factor("digital", "Domaine officiel identifié", 5, web.domain));
  }

  if (web.serpPosition) {
    const points = web.serpPosition <= 1 ? 25 : web.serpPosition <= 3 ? 20 : web.serpPosition <= 10 ? 12 : 5;
    value += points;
    evidence.push(`Position SERP observée : ${web.serpPosition}`);
    factors.push(factor("digital", "Visibilité moteur de recherche", points * WEIGHTS.digital, `Résultat organique position ${web.serpPosition}`));
  }

  if (web.technologies.length) {
    const points = Math.min(20, 8 + web.technologies.length);
    value += points;
    evidence.push(`${web.technologies.length} technologie(s) détectée(s)`);
    factors.push(factor("digital", "Empreinte technologique", points * WEIGHTS.digital, web.technologies.slice(0, 5).join(" · ")));
  }

  if (web.description) {
    value += 8;
    evidence.push("Description d’activité web disponible");
  }

  // A social handle returned by a commercial enrichment provider is useful context,
  // but is not trusted enough to influence scoring until it is independently recouped.

  return {
    subscore: {
      id: "digital",
      label: "Digital Presence",
      value: clamp(value),
      weight: WEIGHTS.digital,
      confidence: confidenceForEvidence(evidence.length, 4),
      evidence,
    },
    factors,
  };
}

function commercialScore(input: ScoreInput): { subscore: ScoreSubscore; factors: ScoreFactor[] } {
  const { company, enrichment } = input;
  const evidence: string[] = [];
  const factors: ScoreFactor[] = [];
  let value = 15;

  if (company.employer) {
    value += 22;
    evidence.push("Employeur déclaré");
    factors.push(factor("commercial", "Employeur identifié", 7, "Caractère employeur déclaré par la source officielle"));
  }

  const band = company.employeeBand ? EMPLOYEE_BAND_POINTS[company.employeeBand] : undefined;
  if (typeof band === "number") {
    const points = Math.round(band * 0.35);
    value += points;
    evidence.push(`Tranche d’effectif INSEE : ${company.employeeBand}`);
    factors.push(factor("commercial", "Taille exploitable", points * WEIGHTS.commercial, `Tranche d’effectif ${company.employeeBand}`));
  }

  const open = company.openEstablishmentCount || 0;
  if (open > 1) {
    const points = Math.min(22, 6 + Math.round(Math.log2(open) * 4));
    value += points;
    evidence.push(`${open} établissements ouverts`);
    factors.push(factor("commercial", "Empreinte multi-sites", points * WEIGHTS.commercial, `${open} établissements ouverts`));
  }

  const contactSignals = (enrichment.web?.genericEmails.length || 0) + (enrichment.web?.phoneNumbers.length || 0);
  if (contactSignals > 0) {
    const points = Math.min(12, 4 + contactSignals * 2);
    value += points;
    evidence.push(`${contactSignals} point(s) de contact public(s)`);
    factors.push(factor("commercial", "Contactabilité publique", points * WEIGHTS.commercial, `${contactSignals} email(s)/téléphone(s) générique(s) détecté(s)`));
  }

  if (enrichment.web?.domain) {
    value += 6;
    evidence.push("Domaine exploitable pour enrichissement à la demande");
  }

  return {
    subscore: {
      id: "commercial",
      label: "Commercial Fit",
      value: clamp(value),
      weight: WEIGHTS.commercial,
      confidence: confidenceForEvidence(evidence.length, 5),
      evidence,
    },
    factors,
  };
}

export function computeOpportunityScore(input: ScoreInput): ExplainableScore {
  const components = [
    healthScore(input),
    growthScore(input),
    digitalScore(input),
    commercialScore(input),
  ];
  const subscores = components.map((item) => item.subscore);
  const factors = components.flatMap((item) => item.factors).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const value = clamp(
    subscores.reduce((total, subscore) => total + subscore.value * subscore.weight, 0),
  );

  const families = [
    ["Données légales", input.company.evidence.length > 0],
    ["RNE", hasFact(input.facts, "rne_siren")],
    ["Web / SERP", Boolean(input.enrichment.web?.domain || input.enrichment.web?.websiteUrl)],
    ["Firmographie web", Boolean(input.enrichment.web?.industry || input.enrichment.web?.technologies.length)],
    ["Actualités", input.enrichment.news.length > 0],
    ["Historique", input.events.length > 0 || input.signals.length > 0],
  ] as const;
  const present = families.filter(([, available]) => available).map(([label]) => label);
  const missing = families.filter(([, available]) => !available).map(([label]) => label);
  const coveragePercent = Math.round((present.length / families.length) * 100);
  const confidence: ExplainableScore["confidence"] =
    coveragePercent >= 80 ? "high" : coveragePercent >= 50 ? "medium" : "low";

  return {
    value,
    confidence,
    label: value >= 75 ? "Opportunité forte à qualifier" : value >= 60 ? "Potentiel intéressant" : value >= 45 ? "Signal à approfondir" : "Peu de signaux exploitables",
    factors,
    subscores,
    basis: {
      mode: "absolute-evidence",
      description: "Score composite pondéré de signaux observables. Ce n’est pas un percentile : 75/100 ne signifie pas que l’entreprise dépasse 75 % des sociétés françaises.",
      coveragePercent,
      evidenceFamilies: present,
      missingFamilies: missing,
      benchmarkStatus: "not-enough-data",
      benchmarkDescription: "Benchmark sectoriel non affiché tant qu’un échantillon comparable suffisant n’est pas historisé dans le moteur.",
    },
    version: "opportunity-v0.2.1-composite",
  };
}
