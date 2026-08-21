import type {
  CompanyBusinessTrigger,
  CompanyEnrichment,
  CompanyFinancialInsight,
  CompanyIntelligenceSummary,
  CompanyProfile,
  ExplainableScore,
} from "@/types/company";
import type { CompanySignal } from "@/types/intelligence";
import { activityLabel, employeeBandLabel } from "./labels";
import {
  hasRecentCriticalLegalEvent,
  isRecentLegalEvent,
} from "./legal-events";

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pct(current?: number, previous?: number): number | undefined {
  if (current === undefined || previous === undefined || previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function financialInsight(raw: unknown): CompanyFinancialInsight {
  if (!raw || typeof raw !== "object") return { assessment: "unknown", notes: ["Aucun exercice financier exploitable"] };
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object")
    .sort(([a], [b]) => b.localeCompare(a));
  const latest = entries[0];
  const previous = entries[1];
  if (!latest) return { assessment: "unknown", notes: ["Aucun exercice financier exploitable"] };

  const latestData = latest[1] as Record<string, unknown>;
  const previousData = previous?.[1] as Record<string, unknown> | undefined;
  const revenue = numberValue(latestData.ca ?? latestData.chiffre_affaires);
  const netIncome = numberValue(latestData.resultat_net ?? latestData.resultat);
  const previousRevenue = previousData ? numberValue(previousData.ca ?? previousData.chiffre_affaires) : undefined;
  const previousNetIncome = previousData ? numberValue(previousData.resultat_net ?? previousData.resultat) : undefined;
  const netMarginPercent = revenue !== undefined && revenue !== 0 && netIncome !== undefined ? (netIncome / revenue) * 100 : undefined;
  const revenueGrowthPercent = pct(revenue, previousRevenue);
  const netIncomeGrowthPercent = pct(netIncome, previousNetIncome);
  const notes: string[] = [];

  if (netIncome !== undefined && netIncome < 0) notes.push("Résultat net négatif sur le dernier exercice disponible");
  if (netMarginPercent !== undefined && netMarginPercent >= 0 && netMarginPercent < 1) notes.push(`Marge nette très faible (${netMarginPercent.toFixed(2)} %)`);
  else if (netMarginPercent !== undefined && netMarginPercent < 3) notes.push(`Marge nette modérée (${netMarginPercent.toFixed(2)} %)`);
  else if (netMarginPercent !== undefined) notes.push(`Marge nette observée : ${netMarginPercent.toFixed(2)} %`);
  if (revenueGrowthPercent !== undefined) notes.push(`Évolution du CA : ${revenueGrowthPercent >= 0 ? "+" : ""}${revenueGrowthPercent.toFixed(1)} %`);
  if (revenue === undefined && netIncome === undefined) notes.push("Montants financiers non renseignés sur le dernier exercice retourné");

  const assessment: CompanyFinancialInsight["assessment"] =
    netIncome !== undefined && netIncome < 0
      ? "watch"
      : netMarginPercent !== undefined && netMarginPercent < 1
        ? "watch"
        : revenueGrowthPercent !== undefined && revenueGrowthPercent > 5
          ? "strong"
          : revenue !== undefined
            ? "stable"
            : "unknown";

  return {
    year: latest[0],
    revenue,
    netIncome,
    netMarginPercent,
    previousRevenue,
    revenueGrowthPercent,
    previousNetIncome,
    netIncomeGrowthPercent,
    assessment,
    notes,
  };
}

function triggerSummary(trigger: CompanyBusinessTrigger): string {
  const date = trigger.occurredAt ? new Date(trigger.occurredAt) : null;
  const dateLabel = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("fr-FR") : undefined;
  return [trigger.label, dateLabel].filter(Boolean).join(" · ");
}

function triggeredAction(trigger?: CompanyBusinessTrigger): string {
  if (!trigger) return "Qualifier l’opportunité en priorité et vérifier la preuve déclenchante avant toute action commerciale.";
  if (trigger.type === "PUBLIC_CONTRACT_AWARD") {
    return "Qualifier le marché public attribué, son périmètre et ses besoins induits avant de décider d’une action commerciale.";
  }
  if (trigger.type === "HIRING") {
    return "Qualifier la dynamique de recrutement et les besoins opérationnels qu’elle peut révéler avant de prioriser une action.";
  }
  if (trigger.type === "ESTABLISHMENT_OPENING") {
    return "Qualifier l’expansion géographique, les nouveaux sites et les besoins associés avant de prioriser une action.";
  }
  if (trigger.type === "FINANCIAL_GROWTH") {
    return "Qualifier la croissance observée et vérifier si elle s’accompagne d’investissements ou de nouveaux projets.";
  }
  if (trigger.type === "LEGAL_CHANGE") {
    return "Examiner le changement juridique récent et confirmer son impact opérationnel avant de prioriser l’opportunité.";
  }
  return "Qualifier le déclencheur récent et son impact opérationnel avant de prioriser une action commerciale.";
}

export function buildCompanyIntelligenceSummary(input: {
  company: CompanyProfile;
  enrichment: CompanyEnrichment;
  score: ExplainableScore;
  signals: CompanySignal[];
  businessTriggers?: CompanyBusinessTrigger[];
}): CompanyIntelligenceSummary {
  const { company, enrichment, score, signals } = input;
  const businessTriggers = input.businessTriggers || [];
  const financial = financialInsight(company.rawFinancials);
  const strengths: string[] = [];
  const vigilance: string[] = [];
  const triggerLabels: string[] = [];
  const activity = activityLabel(company.nafCode, company.activityLabel);
  const size = employeeBandLabel(company.employeeBand);
  const open = company.openEstablishmentCount || 0;
  const positiveTriggers = businessTriggers
    .filter((trigger) => trigger.direction !== "negative")
    .sort((a, b) => b.strength * b.confidence - a.strength * a.confidence);
  const negativeTriggers = businessTriggers.filter((trigger) => trigger.direction === "negative");
  const topTrigger = positiveTriggers[0];

  if (company.status === "active") strengths.push("Entreprise administrativement active");
  if (size) strengths.push(`Structure ${size.toLocaleLowerCase("fr-FR")}`);
  if (open > 1) strengths.push(`Empreinte multi-sites : ${open} établissements ouverts`);
  if (enrichment.web?.domainVerified && enrichment.web.domain) strengths.push(`Présence digitale recoupée sur ${enrichment.web.domain}`);
  if (topTrigger?.type === "PUBLIC_CONTRACT_AWARD") strengths.push("Activité marchés publics récente documentée");
  else if (topTrigger?.type === "HIRING") strengths.push("Recrutement actif détecté sur la surface officielle");
  else if (topTrigger?.type === "ESTABLISHMENT_OPENING") strengths.push("Expansion géographique récente détectée");

  if (company.status === "closed") vigilance.push("Entreprise administrativement fermée");
  vigilance.push(...financial.notes.filter((note) => /faible|négatif|modérée/i.test(note)));
  const legalCritical = enrichment.legalEvents.filter(
    (event) => event.risk === "critical" && isRecentLegalEvent(event, 365),
  );
  const legalWarning = enrichment.legalEvents.filter(
    (event) => event.risk === "warning" && isRecentLegalEvent(event, 365),
  );
  if (legalCritical.length) vigilance.push(`${legalCritical.length} procédure(s) BODACC critique(s) récente(s) à examiner avant toute action`);
  if (legalWarning.length) vigilance.push(`${legalWarning.length} événement(s) juridique(s) récent(s) à surveiller`);
  for (const trigger of negativeTriggers.slice(0, 2)) vigilance.push(trigger.label);
  if (!vigilance.length) vigilance.push("Aucun signal de vigilance majeur détecté dans les sources couvertes");

  for (const trigger of positiveTriggers.slice(0, 5)) triggerLabels.push(triggerSummary(trigger));
  if (!triggerLabels.length) {
    for (const signal of signals.filter((signal) => !["LEGAL_RISK", "CONTRACTION"].includes(signal.type)).slice(0, 2)) {
      triggerLabels.push(signal.label);
    }
  }

  const headlineParts = [activity, size, open > 1 ? `${open} établissements actifs` : undefined].filter(Boolean);
  const headline = headlineParts.length
    ? `${company.name} — ${headlineParts.join(" · ")}`
    : `${company.name} — profil entreprise consolidé`;

  const recentCritical = hasRecentCriticalLegalEvent(enrichment.legalEvents);
  const nextBestAction = recentCritical
    ? "Suspendre la priorisation commerciale et examiner la procédure BODACC critique récente avant toute prise de contact."
    : company.status === "closed"
      ? "Ne pas prioriser commercialement cette entité tant que son statut administratif reste fermé."
      : score.opportunity.status === "triggered"
        ? triggeredAction(topTrigger)
        : score.opportunity.status === "watch"
          ? "Maintenir l’entreprise sous surveillance et réévaluer la priorité à l’apparition d’un marché gagné, recrutement, nouvel établissement, évolution financière ou événement juridique significatif."
          : "Compléter les données temporelles avant de prioriser une action commerciale.";

  return {
    headline,
    strengths: Array.from(new Set(strengths)).slice(0, 4),
    vigilance: Array.from(new Set(vigilance)).slice(0, 4),
    triggers: Array.from(new Set(triggerLabels)).slice(0, 5),
    nextBestAction,
    financial,
  };
}
